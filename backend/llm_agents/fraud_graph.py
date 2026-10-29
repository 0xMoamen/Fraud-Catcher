# backend/llm_agents/fraud_graph.py
import os
import json
from typing import TypedDict, List
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

# 1. Load the .env file FIRST
load_dotenv()

# ==========================================
# 2. DEFINE THE STATE
# ==========================================
class FraudState(TypedDict):
    transaction_json: str
    analyzer_notes: str
    investigator_notes: str
    final_score: int
    final_verdict: str
    final_signals: List[str]
    final_reasoning: str

# ==========================================
# 3. CONFIGURE THE LLM (Fixed for LangChain)
# ==========================================
llm = ChatOpenAI(
    model="openrouter/auto",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),  # LangChain expects this exact kwarg
    openai_api_base="https://openrouter.ai/api/v1",  # LangChain expects this exact kwarg
    temperature=0.0,
)



# ==========================================
# 3. DEFINE THE AGENTS (Nodes)
# ==========================================
def analyzer_node(state: FraudState) -> dict:
    """Agent 1: Focuses purely on numerical anomalies, velocity, and behavioral deviation."""
    prompt = f"""
    You are the Data Analyzer. Review this transaction JSON strictly for numerical anomalies:
    {state['transaction_json']}
    
    Focus on: 
    1. velocity_last_1h, velocity_24h, and amount_sum_24h. (Is this transaction a huge chunk of their 24h volume?)
    2. amount vs avg_transaction_amount_30d. (Is this amount > 5x their 30-day average? That is a massive behavioral deviation.)
    
    Return ONLY a brief 2-sentence summary of numerical risks. If none, say "No numerical anomalies."
    """
    response = llm.invoke(prompt)
    return {"analyzer_notes": response.content.strip()}

def investigator_node(state: FraudState) -> dict:
    """Agent 2: Focuses on behavioral patterns, typologies, and historical context."""
    prompt = f"""
    You are the Fraud Investigator. Review this transaction JSON strictly for behavioral red flags:
    {state['transaction_json']}
    
    Focus on: 
    1. ip_proxy, device_new, merchant_country vs customer_country.
    2. recent_history_summary: Compare the current transaction against their recent history. Does this transaction break their normal pattern?
    
    Return ONLY a brief 2-sentence summary of behavioral risks. If none, say "No behavioral red flags."
    """
    response = llm.invoke(prompt)
    return {"investigator_notes": response.content.strip()}

def judge_node(state: FraudState) -> dict:
    """Agent 3: Synthesizes findings and outputs the final strict JSON."""
    prompt = f"""
    You are the Chief Fraud Judge. Synthesize these two reports:
    - Analyzer Notes: {state['analyzer_notes']}
    - Investigator Notes: {state['investigator_notes']}
    
    Original Transaction: {state['transaction_json']}
    
    Assign a fraud_score (0-100) and verdict ("low", "medium", "high").
    You MUST return ONLY valid JSON matching this exact schema:
    {{
      "fraud_score": integer,
      "verdict": "low" | "medium" | "high",
      "signals": ["list", "of", "specific", "fields"],
      "reasoning": "2-3 sentences max combining both agents' findings"
    }}
    """
    response = llm.invoke(prompt)
    
    try:
        # Clean up markdown code blocks if the LLM adds them
        raw_text = response.content.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
            
        result = json.loads(raw_text)
        return {
            "final_score": int(result.get("fraud_score", 50)),
            "final_verdict": result.get("verdict", "medium"),
            "final_signals": result.get("signals", []),
            "final_reasoning": result.get("reasoning", "No reasoning provided.")
        }
    except Exception as e:
        return {
            "final_score": 50,
            "final_verdict": "medium",
            "final_signals": ["JSON_PARSE_ERROR"],
            "final_reasoning": f"Failed to parse LLM output: {str(e)}"
        }

# ==========================================
# 4. BUILD THE GRAPH
# ==========================================
def build_fraud_graph():
    workflow = StateGraph(FraudState)
    
    # Add nodes
    workflow.add_node("analyzer", analyzer_node)
    workflow.add_node("investigator", investigator_node)
    workflow.add_node("judge", judge_node)
    
    # Define the flow: Analyzer & Investigator run in parallel (conceptually), then Judge
    workflow.set_entry_point("analyzer")
    workflow.add_edge("analyzer", "investigator")
    workflow.add_edge("investigator", "judge")
    workflow.add_edge("judge", END)
    
    return workflow.compile()

# Initialize the graph globally so it's ready to use
fraud_graph = build_fraud_graph()

def run_fraud_analysis(tx_dict: dict) -> dict:
    """Helper function to run the graph and return clean results."""
    initial_state = {
        "transaction_json": json.dumps(tx_dict, indent=2),
        "analyzer_notes": "",
        "investigator_notes": "",
        "final_score": 0,
        "final_verdict": "",
        "final_signals": [],
        "final_reasoning": ""
    }
    
    # Execute the graph
    final_state = fraud_graph.invoke(initial_state)
    
    return {
        "fraud_score": final_state["final_score"],
        "verdict": final_state["final_verdict"],
        "signals": final_state["final_signals"],
        "reasoning": final_state["final_reasoning"]
    }