# backend/graph_engine/feature_engineer.py
import pandas as pd
import numpy as np
from typing import Dict, Tuple, List
import time

class AMLFeatureEngineer:
    """
    Calculates the 127 base features + 5 label features for AML detection.
    Mirrors the logic from the Kaggle notebook (money-laundry-gnn-v3.ipynb).
    """
    
    def __init__(self, transactions_df: pd.DataFrame):
        """
        transactions_df should have columns matching the IBM dataset:
        timestamp, from_bank, src_acc, to_bank, dst_acc, amt_recv, cur_recv,
        amt_paid, cur_paid, fmt, is_laundering
        """
        self.df = transactions_df.copy()
        self.N = 0
        self.account_to_idx = {}
        self.idx_to_account = {}
        self.feature_names: List[str] = []
        
    def _create_account_index(self):
        """Map all accounts to indices 0..N-1"""
        src_key = self.df["from_bank"].astype(str) + "_" + self.df["src_acc"].astype(str)
        dst_key = self.df["to_bank"].astype(str) + "_" + self.df["dst_acc"].astype(str)
        codes, uniques = pd.factorize(pd.concat([src_key, dst_key], ignore_index=True))
        E = len(self.df)
        self.src = codes[:E].astype(np.int64)
        self.dst = codes[E:].astype(np.int64)
        self.N = len(uniques)
        self.uniques = uniques
        self.account_to_idx = {acc: idx for idx, acc in enumerate(uniques)}
        self.idx_to_account = {idx: acc for acc, idx in self.account_to_idx.items()}
        print(f"   Accounts (nodes): {self.N:,} | Transactions (edges): {E:,}")
        
    def _setup_common_arrays(self):
        """Pre-compute common arrays used across feature groups"""
        N = self.N
        E = len(self.df)
        
        # Categorical encodings
        currencies = sorted(set(self.df["cur_recv"].astype(str)) | set(self.df["cur_paid"].astype(str)))
        formats = sorted(self.df["fmt"].astype(str).unique())
        self.currencies = currencies
        self.formats = formats
        
        cur_paid = pd.Categorical(self.df["cur_paid"].astype(str), categories=currencies).codes.astype(np.int64)
        cur_recv = pd.Categorical(self.df["cur_recv"].astype(str), categories=currencies).codes.astype(np.int64)
        fmt = pd.Categorical(self.df["fmt"].astype(str), categories=formats).codes.astype(np.int64)
        C, Fm = len(currencies), len(formats)
        
        # USD conversion rates
        rate = pd.Series(1.0, index=currencies)
        m = (self.df["cur_paid"] == "US Dollar") & (self.df["cur_recv"] != "US Dollar") & (self.df["amt_recv"] > 0)
        if m.any():
            rate.update((self.df.loc[m, "amt_paid"] / self.df.loc[m, "amt_recv"]).groupby(self.df.loc[m, "cur_recv"]).median())
        rate_arr = rate.loc[currencies].to_numpy()
        
        usd_paid = self.df["amt_paid"].clip(lower=0).to_numpy(np.float64) * rate_arr[cur_paid]
        usd_recv = self.df["amt_recv"].clip(lower=0).to_numpy(np.float64) * rate_arr[cur_recv]
        
        # Time
        ts = pd.to_datetime(self.df["timestamp"], format="%Y/%m/%d %H:%M")
        hours = ((ts - ts.min()).dt.total_seconds() / 3600).to_numpy()
        ts_norm = hours / max(hours.max(), 1e-9)
        day = (hours // 24).astype(np.int64)
        
        # Flags
        cross_cur = (cur_paid != cur_recv).astype(np.float32)
        cross_bank = (self.df["from_bank"].to_numpy() != self.df["to_bank"].to_numpy()).astype(np.float32)
        
        # Store for later use
        self.usd_paid = usd_paid
        self.usd_recv = usd_recv
        self.hours = hours
        self.ts_norm = ts_norm
        self.day = day
        self.cross_cur = cross_cur
        self.cross_bank = cross_bank
        self.cur_paid = cur_paid
        self.cur_recv = cur_recv
        self.fmt = fmt
        self.C = C
        self.Fm = Fm
        
        # Pair structure
        key = self.src * N + self.dst
        uk, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
        self.pair_cnt = cnt[inv].astype(np.float64)
        s_u, d_u = uk // N, uk % N
        rkey = self.dst * N + self.src
        j = np.minimum(np.searchsorted(uk, rkey), len(uk) - 1)
        self.rev_cnt = np.where(uk[j] == rkey, cnt[j], 0).astype(np.float64)
        self.s_u = s_u
        self.d_u = d_u
        self.uk = uk
        
        # Forwarding / layering
        self._compute_forwarding()
        
    def _compute_forwarding(self):
        """Compute forwarding/layering features using as-of joins"""
        N = self.N
        E = len(self.df)
        W = 24  # fwd_window_hours
        
        def asof(left_node, right_node, right_val, direction):
            L = pd.DataFrame({"node": left_node, "t": self.hours, "i": np.arange(E)}).sort_values("t")
            R = pd.DataFrame({"node": right_node, "t2": self.hours, "v": right_val}).sort_values("t2")
            M = pd.merge_asof(L, R, left_on="t", right_on="t2", by="node",
                              direction=direction, allow_exact_matches=False)
            i = M["i"].to_numpy()
            delay = np.full(E, np.nan)
            val = np.full(E, np.nan)
            delay[i] = np.abs(M["t"].to_numpy() - M["t2"].to_numpy())
            val[i] = M["v"].to_numpy()
            return delay, val
        
        delay_prev, r_prev = asof(self.src, self.dst, self.usd_recv, "backward")
        delay_next, p_next = asof(self.dst, self.src, self.usd_paid, "forward")
        
        ratio_prev = self.usd_paid / (r_prev + 1e-9)
        ratio_next = p_next / (self.usd_recv + 1e-9)
        
        ff_out = (delay_prev <= W) & (ratio_prev >= 0.5) & (ratio_prev <= 1.1)
        ff_in = (delay_next <= W) & (ratio_next >= 0.5) & (ratio_next <= 1.1)
        
        LD_MAX = np.log1p(1e4)
        ld_prev = np.log1p(np.nan_to_num(delay_prev, nan=1e4))
        ld_next = np.log1p(np.nan_to_num(delay_next, nan=1e4))
        rp = np.clip(np.nan_to_num(ratio_prev, nan=0.0), 0, 3)
        rn = np.clip(np.nan_to_num(ratio_next, nan=0.0), 0, 3)
        
        self.ff_out = ff_out
        self.ff_in = ff_in
        self.ld_prev = ld_prev
        self.ld_next = ld_next
        self.rp = rp
        self.rn = rn
        self.LD_MAX = LD_MAX
        
        # Amount percentiles
        lp = np.log1p(self.usd_paid)
        lr_ = np.log1p(self.usd_recv)
        self.pct_out = pd.Series(lp).groupby(self.src).rank(pct=True).to_numpy()
        self.pct_in = pd.Series(lr_).groupby(self.dst).rank(pct=True).to_numpy()
        
        # Windowed context (bursts)
        BIGT = self.hours.max() + 6 * W + 10
        def make_events(node, amt):
            ck = node.astype(np.float64) * BIGT + (self.hours + 3 * W)
            o = np.argsort(ck, kind="stable")
            return ck[o], np.concatenate([[0.0], np.cumsum(amt[o])])
        def win(events, node, lo, hi, lo_side, hi_side):
            ck, cs = events
            base = node.astype(np.float64) * BIGT + (self.hours + 3 * W)
            a = np.searchsorted(ck, base + lo, side=lo_side)
            b = np.searchsorted(ck, base + hi, side=hi_side)
            return (b - a).astype(np.float64), cs[b] - cs[a]
        
        ev_out, ev_in = make_events(self.src, self.usd_paid), make_events(self.dst, self.usd_recv)
        c_src_out, _ = win(ev_out, self.src, -W, W, "left", "right")
        c_src_in, s_src_in = win(ev_in, self.src, -W, 0, "left", "left")
        c_dst_out, s_dst_out = win(ev_out, self.dst, 0, W, "right", "right")
        c_dst_in, _ = win(ev_in, self.dst, -W, W, "left", "right")
        
        gather = np.where(s_src_in > 0, np.clip(self.usd_paid / (s_src_in + 1e-9), 0, 5), 0.0)
        scatter = np.where(s_dst_out > 0, np.clip(s_dst_out / (self.usd_recv + 1e-9), 0, 5), 0.0)
        
        self.c_src_out = c_src_out
        self.c_src_in = c_src_in
        self.c_dst_out = c_dst_out
        self.c_dst_in = c_dst_in
        self.gather = gather
        self.scatter = scatter
        self.lp = lp
        self.lr_ = lr_
        
    def _bc(self, idx, w=None):
        return np.bincount(idx, weights=w, minlength=self.N)
    
    def _sdiv(self, a, b):
        return np.divide(a, b, out=np.zeros(self.N, dtype=np.float64), where=b > 0)
    
    def _grp(self, values, idx, how):
        return np.array(getattr(pd.Series(values).groupby(idx), how)()
                        .reindex(range(self.N)).fillna(0).to_numpy())
    
    def calculate_all_features(self) -> Tuple[np.ndarray, List[str]]:
        """Calculate all 127 base features for all accounts."""
        print("🔄 Creating account index...")
        self._create_account_index()
        print("📊 Setting up common arrays...")
        self._setup_common_arrays()
        
        print(f"📊 Calculating features for {self.N:,} accounts...")
        t0 = time.time()
        
        N = self.N
        feats = {}
        
        # ---- Node features (matching notebook Section 4) ----
        n_out, n_in = self._bc(self.src), self._bc(self.dst)
        lp, lr_ = self.lp, self.lr_
        sum_out, sum_in = self._bc(self.src, self.usd_paid), self._bc(self.dst, self.usd_recv)
        
        feats["log_n_out"] = np.log1p(n_out.astype(np.float64))
        feats["log_n_in"] = np.log1p(n_in.astype(np.float64))
        feats["log_sum_out"] = np.log1p(sum_out)
        feats["log_sum_in"] = np.log1p(sum_in)
        feats["flow_balance"] = (sum_in - sum_out) / (sum_in + sum_out + 1.0)
        feats["log_volume"] = np.log1p(sum_in + sum_out)
        
        mo = self._sdiv(self._bc(self.src, lp), n_out)
        mi = self._sdiv(self._bc(self.dst, lr_), n_in)
        feats["mean_log_out"] = mo
        feats["mean_log_in"] = mi
        feats["std_log_out"] = np.sqrt(np.clip(self._sdiv(self._bc(self.src, lp**2), n_out) - mo**2, 0, None))
        feats["std_log_in"] = np.sqrt(np.clip(self._sdiv(self._bc(self.dst, lr_**2), n_in) - mi**2, 0, None))
        feats["max_log_out"] = self._grp(lp, self.src, "max")
        feats["max_log_in"] = self._grp(lr_, self.dst, "max")
        
        # Distinct counterparties
        u_out = self._bc(self.s_u)
        u_in = self._bc(self.d_u)
        feats["log_uniq_out"] = np.log1p(u_out.astype(np.float64))
        feats["log_uniq_in"] = np.log1p(u_in.astype(np.float64))
        feats["repeat_out"] = 1 - self._sdiv(u_out, n_out)
        feats["repeat_in"] = 1 - self._sdiv(u_in, n_in)
        feats["fan_ratio"] = np.log1p(u_in) - np.log1p(u_out)
        feats["selfloop_frac"] = self._sdiv(self._bc(self.src[self.src == self.dst]), n_out)
        
        # Obfuscation shares
        feats["cross_cur_out"] = self._sdiv(self._bc(self.src, self.cross_cur), n_out)
        feats["cross_cur_in"] = self._sdiv(self._bc(self.dst, self.cross_cur), n_in)
        feats["cross_bank_out"] = self._sdiv(self._bc(self.src, self.cross_bank), n_out)
        feats["cross_bank_in"] = self._sdiv(self._bc(self.dst, self.cross_bank), n_in)
        
        for f in range(self.Fm):
            feats[f"fmt_out_{self.formats[f]}"] = self._sdiv(self._bc(self.src[self.fmt == f]), n_out)
            feats[f"fmt_in_{self.formats[f]}"] = self._sdiv(self._bc(self.dst[self.fmt == f]), n_in)
        
        for c in range(self.C):
            feats[f"cur_out_{self.currencies[c]}"] = self._sdiv(self._bc(self.src[self.cur_paid == c]), n_out)
            feats[f"cur_in_{self.currencies[c]}"] = self._sdiv(self._bc(self.dst[self.cur_recv == c]), n_in)
        
        # Timing
        dmax = lambda idx: (pd.DataFrame({"n": idx, "d": self.day}).groupby(["n", "d"]).size()
                            .groupby(level=0).max().reindex(range(N)).fillna(0).to_numpy())
        feats["log_max_daily_out"] = np.log1p(dmax(self.src).astype(np.float64))
        feats["log_max_daily_in"] = np.log1p(dmax(self.dst).astype(np.float64))
        feats["time_std_out"] = self._grp(self.hours, self.src, "std") / 24
        feats["time_std_in"] = self._grp(self.hours, self.dst, "std") / 24
        
        first = np.minimum(self._grp(self.hours, self.src, "min") + 1e9 * (n_out == 0),
                           self._grp(self.hours, self.dst, "min") + 1e9 * (n_in == 0))
        last = np.maximum(self._grp(self.hours, self.src, "max"), self._grp(self.hours, self.dst, "max"))
        feats["active_span_days"] = np.where(first < 1e8, last - first, 0) / 24
        
        # Neighbourhood context (1 hop)
        ld_out = np.log1p(n_out.astype(np.float64))
        ld_in = np.log1p(n_in.astype(np.float64))
        feats["nbr_src_outdeg"] = self._sdiv(self._bc(self.dst, ld_out[self.src]), n_in)
        feats["nbr_src_indeg"] = self._sdiv(self._bc(self.dst, ld_in[self.src]), n_in)
        feats["nbr_dst_outdeg"] = self._sdiv(self._bc(self.src, ld_out[self.dst]), n_out)
        feats["nbr_dst_indeg"] = self._sdiv(self._bc(self.src, ld_in[self.dst]), n_out)
        
        # Bank size
        node_bank = np.zeros(N, dtype=np.int64)
        node_bank[self.src] = self.df["from_bank"].to_numpy()
        node_bank[self.dst] = self.df["to_bank"].to_numpy()
        _, inv, cnt = np.unique(node_bank, return_inverse=True, return_counts=True)
        feats["log_bank_size"] = np.log1p(cnt[inv].astype(np.float64))
        
        # Count features
        for f in range(self.Fm):
            feats[f"log_cnt_fmt_out_{self.formats[f]}"] = np.log1p(self._bc(self.src[self.fmt == f]).astype(np.float64))
            feats[f"log_cnt_fmt_in_{self.formats[f]}"] = np.log1p(self._bc(self.dst[self.fmt == f]).astype(np.float64))
        for nm, arr in [("xbank", self.cross_bank), ("xcur", self.cross_cur)]:
            feats[f"log_cnt_{nm}_out"] = np.log1p(self._bc(self.src, arr).astype(np.float64))
            feats[f"log_cnt_{nm}_in"] = np.log1p(self._bc(self.dst, arr).astype(np.float64))
        
        feats["log_n_ffwd_out"] = np.log1p(self._bc(self.src, self.ff_out.astype(np.float64)))
        feats["log_n_ffwd_in"] = np.log1p(self._bc(self.dst, self.ff_in.astype(np.float64)))
        
        mdo = self._grp(self.ld_prev, self.src, "min")
        mdo[n_out == 0] = self.LD_MAX
        mdi = self._grp(self.ld_next, self.dst, "min")
        mdi[n_in == 0] = self.LD_MAX
        feats["min_log_delay_out"] = mdo
        feats["min_log_delay_in"] = mdi
        
        recip_ok = (self.uk[np.minimum(np.searchsorted(self.uk, self.d_u * N + self.s_u), len(self.uk) - 1)] == self.d_u * N + self.s_u) & (self.s_u != self.d_u)
        feats["log_recip"] = np.log1p(self._bc(self.s_u[recip_ok]).astype(np.float64))
        
        # ---- Neighbour aggregates (mean over an account's senders / receivers) ----
        import scipy.sparse as sp
        KEYS = ["log_n_out", "log_n_in", "flow_balance", "log_sum_out", "log_sum_in",
                "log_uniq_out", "log_uniq_in", "mean_log_out", "mean_log_in",
                "cross_bank_out", "cross_bank_in", "log_n_ffwd_out", "log_n_ffwd_in", "log_recip"]
        
        feature_names = list(feats.keys())
        kidx = [feature_names.index(k) for k in KEYS]
        
        X_base = np.column_stack([feats[k] for k in feature_names]).astype(np.float32)
        
        A_in = sp.csr_matrix((1.0 / np.maximum(n_in, 1)[self.dst], (self.dst, self.src)), shape=(N, N))
        A_out = sp.csr_matrix((1.0 / np.maximum(n_out, 1)[self.src], (self.src, self.dst)), shape=(N, N))
        Xk_raw = X_base[:, kidx]
        nbr_in = (A_in @ Xk_raw).astype(np.float32)
        nbr_out = (A_out @ Xk_raw).astype(np.float32)
        
        X_base = np.hstack([X_base, nbr_in, nbr_out])
        feature_names += [f"nbr_in_{k}" for k in KEYS] + [f"nbr_out_{k}" for k in KEYS]
        
        # Pad to exactly 127 if needed (shouldn't be, but safety)
        if X_base.shape[1] < 127:
            padding = np.zeros((N, 127 - X_base.shape[1]), dtype=np.float32)
            X_base = np.hstack([X_base, padding])
            feature_names += [f"pad_{i}" for i in range(127 - len(feature_names))]
        elif X_base.shape[1] > 127:
            X_base = X_base[:, :127]
            feature_names = feature_names[:127]
        
        self.feature_names = feature_names
        print(f"✅ Calculated {X_base.shape[1]} base features in {time.time()-t0:.1f}s")
        return X_base, feature_names
    
    def calculate_label_features(self, known_labels: Dict[str, int]) -> np.ndarray:
        """Calculate the 5 guilt-by-association label features."""
        import scipy.sparse as sp
        N = self.N
        
        known = np.zeros(N, dtype=np.float64)
        for acc, label in known_labels.items():
            if acc in self.account_to_idx:
                known[self.account_to_idx[acc]] = label
        
        # Distinct undirected neighbours
        ns = self.s_u != self.d_u
        a_ = np.concatenate([self.s_u, self.d_u])
        b_ = np.concatenate([self.d_u, self.s_u])
        keep = a_ != b_
        pk = np.unique(a_[keep] * N + b_[keep])
        a_, b_ = pk // N, pk % N
        
        n_nbr = self._bc(a_)
        nbr_pos = self._bc(a_, known[b_])
        
        pos_out = self._bc(self.s_u[ns], known[self.d_u[ns]])
        pos_in = self._bc(self.d_u[ns], known[self.s_u[ns]])
        
        A_und = sp.csr_matrix((np.ones(len(a_)), (a_, b_)), shape=(N, N))
        w2 = A_und @ (A_und @ known) - n_nbr * known
        
        XL = np.column_stack([
            np.log1p(nbr_pos),
            np.log1p(pos_out),
            np.log1p(pos_in),
            self._sdiv(nbr_pos, n_nbr),
            np.log1p(np.clip(w2, 0, None))
        ]).astype(np.float32)
        
        print(f"✅ Calculated {XL.shape[1]} label features (known-laundering accounts: {int(known.sum()):,})")
        return XL