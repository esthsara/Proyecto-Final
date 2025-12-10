from flask import Flask, render_template, request, jsonify
import numpy as np
import json
import math
from pathlib import Path

app = Flask(__name__, static_folder="static", template_folder="templates")

# Load sample data
DATA_PATH = Path(__file__).parent / "data" / "sample_data.json"
with open(DATA_PATH, "r", encoding="utf-8") as f:
    SAMPLE = json.load(f)

# --------------------------
# Numerical routines
# --------------------------
def bisection(f, a, b, tol=1e-6, maxiter=100):
    fa = f(a); fb = f(b)
    if fa * fb > 0:
        return {"error": "No hay cambio de signo en el intervalo dado.", "iters": []}
    iters = []
    prev_c = None
    for i in range(maxiter):
        c = (a + b) / 2.0
        fc = f(c)
        err = abs(c - prev_c) if prev_c is not None else None
        iters.append({"iter": i+1, "a": a, "b": b, "c": c, "f(c)": fc, "error": err})
        if abs(fc) < tol or (b - a) / 2 < tol:
            return {"root": c, "iters": iters}
        if fa * fc < 0:
            b = c
            fb = fc
        else:
            a = c
            fa = fc
        prev_c = c
    return {"error": "No convergió en el número máximo de iteraciones", "iters": iters}

def newton(f, df, x0, tol=1e-8, maxiter=50):
    x = float(x0)
    iters = []
    for i in range(maxiter):
        fx = f(x)
        dfx = df(x)
        # avoid division by zero
        if abs(dfx) < 1e-14:
            iters.append({"iter": i+1, "x": x, "f(x)": fx, "f'(x)": dfx, "error": None})
            return {"error": "Derivada cercana a 0, riesgo de división por cero.", "iters": iters}
        x_new = x - fx/dfx
        err = abs(x_new - x)
        iters.append({"iter": i+1, "x": x, "f(x)": fx, "f'(x)": dfx, "x_next": x_new, "error": err})
        if abs(fx) < tol or err < tol:
            return {"root": x_new, "iters": iters}
        x = x_new
    return {"error": "No convergió en el número máximo de iteraciones", "iters": iters}

def regression_linear(x, y):
    coeffs = np.polyfit(x, y, 1)
    poly = np.poly1d(coeffs)
    preds = poly(x)
    return {"coeffs": coeffs.tolist(), "poly": poly, "preds": preds.tolist()}

def regression_poly2(x, y):
    coeffs = np.polyfit(x, y, 2)
    poly = np.poly1d(coeffs)
    preds = poly(x)
    return {"coeffs": coeffs.tolist(), "poly": poly, "preds": preds.tolist()}

def gauss_solve_with_steps(A, b):
    # We will return solution via numpy and a basic note; detailed elimination steps are non-trivial
    try:
        sol = np.linalg.solve(np.array(A, float), np.array(b, float))
        return {"solution": sol.tolist()}
    except Exception as e:
        return {"error": str(e)}

def gauss_seidel(A, b, x0=None, tol=1e-6, maxiter=500):
    A = np.array(A, float)
    b = np.array(b, float)
    n = len(b)
    if x0 is None:
        x = np.zeros(n)
    else:
        x = np.array(x0, float)
    iters = []
    for k in range(maxiter):
        x_old = x.copy()
        for i in range(n):
            denom = A[i, i]
            if abs(denom) < 1e-14:
                return {"error": f"Elemento diagonal A[{i},{i}] = 0 (no se puede dividir).", "iters": iters}
            s1 = A[i, :i] @ x[:i]
            s2 = A[i, i+1:] @ x_old[i+1:]
            x[i] = (b[i] - s1 - s2) / denom
        iters.append({"iter": k+1, "x": x.tolist(), "residual_norm": float(np.linalg.norm(A @ x - b))})
        if np.linalg.norm(x - x_old, ord=np.inf) < tol:
            return {"solution": x.tolist(), "iters": iters}
    return {"error": "No convergió", "iters": iters}

# --------------------------
# Routes
# --------------------------
@app.route("/")
def index():
    careers = SAMPLE["careers"]
    years = SAMPLE["years"]
    return render_template("index.html", careers=careers, years=years, sample=SAMPLE)

@app.route("/api/bisection", methods=["POST"])
def api_bisection():
    payload = request.json
    expr = payload.get("expr")
    a = float(payload.get("a"))
    b = float(payload.get("b"))
    tol = float(payload.get("tol", 1e-6))
    maxiter = int(payload.get("maxiter", 100))
    # Safe eval: allow math and numpy functions via restricted globals
    try:
        f = eval(expr, {"__builtins__": {}}, {"math": math, "np": np})
    except Exception as e:
        return jsonify({"error": f"Expresión inválida: {e}"}), 400
    res = bisection(f, a, b, tol, maxiter)
    return jsonify(res)

@app.route("/api/newton", methods=["POST"])
def api_newton():
    payload = request.json
    expr = payload.get("expr")
    dexpr = payload.get("dexpr")
    x0 = float(payload.get("x0", 1.0))
    tol = float(payload.get("tol", 1e-8))
    maxiter = int(payload.get("maxiter", 50))
    try:
        f = eval(expr, {"__builtins__": {}}, {"math": math, "np": np})
        df = eval(dexpr, {"__builtins__": {}}, {"math": math, "np": np})
    except Exception as e:
        return jsonify({"error": f"Expresión inválida: {e}"}), 400
    res = newton(f, df, x0, tol, maxiter)
    return jsonify(res)

@app.route("/api/regression", methods=["POST"])
def api_regression():
    payload = request.json
    career = payload.get("career")
    model = payload.get("model", "linear")  # 'linear' or 'poly2'
    data = SAMPLE["data"].get(career)
    if data is None:
        return jsonify({"error": "Carrera no encontrada"}), 400
    years = np.array(data["years"], float)
    vals = np.array(data["students"], float)
    if model == "linear":
        reg = regression_linear(years, vals)
    else:
        reg = regression_poly2(years, vals)
    # build predictions for plotting: from min(years) to next_year
    min_y, max_y = int(min(years)), int(max(years))
    next_year = int(payload.get("next_year", max(years) + 1))
    xs_plot = np.arange(min_y, next_year + 1)
    preds_plot = reg["poly"](xs_plot).tolist()
    pred_next = float(reg["poly"](next_year))
    # mse and r2 on training data
    mse = float(np.mean((vals - reg["poly"](years))**2))
    ss_res = np.sum((vals - reg["poly"](years))**2)
    ss_tot = np.sum((vals - np.mean(vals))**2)
    r2 = float(1 - ss_res / ss_tot) if ss_tot != 0 else None
    return jsonify({
        "coeffs": reg["coeffs"],
        "pred_next": pred_next,
        "mse": mse,
        "r2": r2,
        "years": data["years"],
        "students": data["students"],
        "plot_x": xs_plot.tolist(),
        "plot_y": preds_plot
    })

@app.route("/api/budget", methods=["POST"])
def api_budget():
    payload = request.json
    projections = payload.get("projections")  # dict career->students
    p = float(payload.get("price", 350))
    weights = payload.get("weights")  # optional dict career->weight
    if projections is None:
        return jsonify({"error": "Projections required"}), 400
    total_students = sum([float(v) for v in projections.values()])
    Ptotal = p * total_students
    if not weights:
        weights = {k: 1.0 for k in projections.keys()}
    numer = sum([weights[k] * float(projections[k]) for k in projections.keys()])
    allocation = {}
    for k in projections.keys():
        allocation[k] = (weights[k] * float(projections[k]) / numer) * Ptotal if numer != 0 else 0.0
    return jsonify({"Ptotal": Ptotal, "allocation": allocation, "total_students": total_students})

@app.route("/api/solve_system", methods=["POST"])
def api_solve_system():
    payload = request.json
    A = payload.get("A")
    b = payload.get("b")
    method = payload.get("method", "gauss")  # gauss or gs
    if A is None or b is None:
        return jsonify({"error": "A and b required"}), 400
    if method == "gauss":
        res = gauss_solve_with_steps(A, b)
    else:
        x0 = payload.get("x0", None)
        res = gauss_seidel(A, b, x0=x0)
    return jsonify(res)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
