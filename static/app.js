// helper
function el(id){ return document.getElementById(id) }
function qAll(sel){ return Array.from(document.querySelectorAll(sel)) }

// Render helpers
function renderTable(containerId, rows, headers) {
  const container = el(containerId)
  if(!rows || rows.length === 0) {
    container.innerHTML = "<i>No hay iteraciones para mostrar.</i>"
    return
  }
  let html = "<table class='table'><thead><tr>"
  headers.forEach(h => html += `<th>${h}</th>`)
  html += "</tr></thead><tbody>"
  rows.forEach(r=>{
    html += "<tr>"
    headers.forEach(h=>{
      const key = h in r ? h : Object.keys(r).find(k=>k.toLowerCase()===h.toLowerCase()) || h
      html += `<td>${(r[key]===null||r[key]===undefined)?'': (typeof r[key]==='number'? r[key].toPrecision? r[key].toPrecision(6) : r[key] : JSON.stringify(r[key]))}</td>`
    })
    html += "</tr>"
  })
  html += "</tbody></table>"
  container.innerHTML = html
}

function renderKeyValueTable(containerId, obj, valueLabel = 'Valor') {
  const container = el(containerId)
  if(!obj) { container.innerHTML = '<i>No hay datos.</i>'; return }
  let html = "<table class='table'><thead><tr><th>Ítem</th><th>"+valueLabel+"</th></tr></thead><tbody>"
  Object.keys(obj).forEach(k=>{
    html += `<tr><td>${k}</td><td>${Number(obj[k]).toFixed(2)}</td></tr>`
  })
  html += '</tbody></table>'
  container.innerHTML = html
}

function destroyChart(ch) { if(ch && ch.destroy) ch.destroy() }

// Chart holders
let errorChart = null
let regChart = null

// 1) Punto de equilibrio
el("run-bisection").onclick = async () => {
  runRootMethod("bisection")
}
el("run-newton").onclick = async () => {
  runRootMethod("newton")
}

// Setup tabs and navigation between steps
function setupTabs(){
  const tabs = Array.from(document.querySelectorAll('.tab-btn'))
  tabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = btn.dataset.tab
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active')
      document.querySelectorAll('.tab-content').forEach(tc=>tc.classList.remove('active'))
      const elTab = document.getElementById(target)
      if(elTab) elTab.classList.add('active')
      window.scrollTo({top: elTab.offsetTop - 20, behavior: 'smooth'})
    })
  })

  // next/back buttons
  const goTo = (id)=>{ const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`); if(btn) btn.click() }
  const to2 = el('to-tab-2'); if(to2) to2.addEventListener('click', ()=>goTo('tab-2'))
  const to3 = el('to-tab-3'); if(to3) to3.addEventListener('click', ()=>goTo('tab-3'))
  const back1 = el('back-to-tab-1'); if(back1) back1.addEventListener('click', ()=>goTo('tab-1'))
  const back2 = el('back-to-tab-2'); if(back2) back2.addEventListener('click', ()=>goTo('tab-2'))
}

document.addEventListener('DOMContentLoaded', setupTabs)

async function runRootMethod(which) {
  const p = parseFloat(el("price").value)
  const F = parseFloat(el("fixed").value)
  const V = parseFloat(el("var").value)

  // build function expressions safely (strings evaluated server-side with restricted env)
  const expr = `lambda x: ${p}*x - (${F} + ${V}*x)`
  const dexpr = `lambda x: ${p - V}`

  const a = parseFloat(el("bisection-a").value)
  const b = parseFloat(el("bisection-b").value)

  let responses = {}
  if(which === "bisection" || el("compare-methods").value === "both") {
    const res = await fetch("/api/bisection", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({expr, a, b, tol:1e-6, maxiter:100})
    }).then(r=>r.json())
    responses.bisection = res
  }
  if(which === "newton" || el("compare-methods").value === "both") {
    const res = await fetch("/api/newton", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({expr, dexpr, x0: 50, tol:1e-8, maxiter:50})
    }).then(r=>r.json())
    responses.newton = res
  }

  // Render results & tables (resumen legible)
  let sum = ''
  if(responses.bisection && responses.bisection.root) sum += `Bisección ≈ ${Number(responses.bisection.root).toFixed(6)}\n`
  if(responses.newton && responses.newton.root) sum += `Newton ≈ ${Number(responses.newton.root).toFixed(6)}\n`
  el("eq-result").innerText = sum || 'No hay resultado.'

  // Build comparative error chart if both present
  let datasets = []
  let labels = []
  // For each method, prepare error series (error per iter)
  for(const [name, res] of Object.entries(responses)) {
    if(res.iters && res.iters.length>0) {
      const errors = res.iters.map(it => it.error === null || it.error === undefined ? (it["f(c)"]? Math.abs(it["f(c)"]) : (it["x_next"]? Math.abs(it["x_next"] - (it.x||0)) : null)) : Math.abs(it.error))
      const itLabels = res.iters.map(it => `i${it.iter}`)
      if(labels.length < itLabels.length) labels = itLabels
      datasets.push({label: name, data: errors})
      // render table for this method (detailed)
      renderTable("iter-table", res.iters, Object.keys(res.iters[0]||{}))
    } else {
      renderTable("iter-table", [], [])
    }
  }

  // draw error chart
  destroyChart(errorChart)
  const ctx = el("error-chart").getContext("2d")
  errorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets.map((d, idx)=>({
        label: d.label,
        data: d.data,
        fill: false,
        tension: 0.2,
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { title: { display: true, text: 'Error (abs)' } }, x: { title: { display: true, text: 'Iteración' } } }
    }
  })

  // conclusion
  let concl = ""
  if(responses.bisection && responses.bisection.root) concl += `Bisección root ≈ ${Number(responses.bisection.root).toFixed(4)}. `
  if(responses.newton && responses.newton.root) concl += `Newton root ≈ ${Number(responses.newton.root).toFixed(4)}. `
  if(responses.bisection && responses.newton) {
    concl += "Comparación: "
    const rb = responses.bisection.root || null
    const rn = responses.newton.root || null
    if(rb && rn) {
      concl += `Diferencia entre soluciones: ${(Math.abs(rb - rn)).toExponential(3)}. `
      concl += (responses.newton.iters.length < responses.bisection.iters.length) ? "Newton convergió en menos iteraciones." : "Bisección requirió menos iteraciones."
    }
  }
  el("eq-conclusion").innerText = concl
}

// 2) Regression
el("run-reg").onclick = async () => {
  const career = el("reg-career").value
  const model = el("reg-model").value
  const next = parseInt(el("next-year").value)
  const res = await fetch("/api/regression", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({career, model, next_year: next})
  }).then(r=>r.json())

  let html = `<b>${career}</b>\nPredicción para ${next}: ${Number(res.pred_next).toFixed(2)} estudiantes\nMSE: ${Number(res.mse).toFixed(3)}\nR²: ${res.r2===null?'N/A':Number(res.r2).toFixed(3)}\nCoeficientes: ${JSON.stringify(res.coeffs)}`
  el("reg-result").innerText = html

  // show historical data
  let hist = ""
  for(let i=0;i<res.years.length;i++){
    hist += `${res.years[i]} : ${res.students[i]}\n`
  }
  el("reg-data").innerText = hist

  // plot data and fit
  const labels = res.plot_x
  const fit = res.plot_y
  const dataPoints = res.years.map((y, i) => ({x: y, y: res.students[i]}))

  destroyChart(regChart)
  const ctx = el("reg-chart").getContext("2d")
  regChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Datos históricos', data: dataPoints, showLine:false, pointRadius:4 },
        { label: 'Ajuste', data: labels.map((x,i)=>({x: x, y: fit[i]})), showLine:true, fill:false, tension:0.2 }
      ]
    },
    options: {
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Año' } },
        y: { title: { display: true, text: 'Estudiantes' } }
      }
    }
  })

  // conclusion
  let concl = `El modelo ${model === 'linear' ? 'lineal' : 'polinómico grado 2'} predice ${Number(res.pred_next).toFixed(1)} estudiantes para ${next}. `
  concl += `R²=${res.r2===null?'N/A':Number(res.r2).toFixed(3)}, MSE=${Number(res.mse).toFixed(3)}. `
  el("reg-conclusion").innerText = concl
}

// 3) Budget & System
el("use-predictions").onclick = () => {
  SAMPLE.careers.forEach((c)=>{
    const arr = SAMPLE.data[c].students
    const val = arr[arr.length - 1]
    const inp = document.querySelector(`input[data-career="${c}"]`)
    if(inp) inp.value = val
  })
}

el("run-budget").onclick = async () => {
  const price = parseFloat(el("budget-price").value)
  const projInputs = qAll(".proj-val")
  let projections = {}
  projInputs.forEach(inp=>{
    projections[inp.dataset.career] = parseFloat(inp.value) || 0
  })
  const res = await fetch("/api/budget", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({projections, price})
  }).then(r=>r.json())

  // Render allocation as table
  const header = `Total estudiantes: ${res.total_students} — Presupuesto total: ${Number(res.Ptotal).toFixed(2)} Bs`
  el('budget-result').innerText = header
  renderKeyValueTable('system-table', res.allocation, 'Bs')
}

el("run-system").onclick = async () => {
  const inputs = qAll(".proj-val")
  let projections = {}
  inputs.forEach(i=>projections[i.dataset.career] = parseFloat(i.value) || 0)
  const total_students = Object.values(projections).reduce((a,b)=>a+b,0)
  const price = parseFloat(el("budget-price").value)
  const P = price * total_students

  // Build a 6x6 example similar to el anterior (you can change later)
  const A = [
    [1,1,1,1,1,1],
    [-1,1,0,0,0,0],
    [0,0,0,0,1,-1.2],
    [0,0,1,-0.8,0,0],
    [1,0,0,0,0,0],
    [0,0,0,1,0,0]
  ]
  const b = [P,5000,0,0,10000,20000]
  const method = el("system-method").value

  const res = await fetch("/api/solve_system", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({A,b,method})
  }).then(r=>r.json())

  // Render result: prefer solution table, otherwise iterations or error
  if(res.solution) {
    // render solution vector
    const solObj = {}
    res.solution.forEach((val,i)=> solObj[`x${i+1}`] = Number(val))
    renderKeyValueTable('system-table', solObj, 'Valor')
    el('system-conclusion').innerText = `Solución encontrada (${method}).`
  } else if(res.iters && res.iters.length>0) {
    renderTable('system-table', res.iters, Object.keys(res.iters[0]||{}))
    el('system-conclusion').innerText = `Iteraciones (${method}).`;
  } else if(res.allocation) {
    renderKeyValueTable('system-table', res.allocation, 'Bs')
    el('system-conclusion').innerText = `Asignación proporcional.`
  } else if(res.error) {
    el('system-table').innerText = ''
    el('system-conclusion').innerText = `Error: ${res.error}`
  } else {
    el('system-table').innerText = ''
    el('system-conclusion').innerText = 'Resultado inesperado.'
  }
}
