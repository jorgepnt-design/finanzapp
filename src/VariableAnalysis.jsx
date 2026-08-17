import React, { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, ShoppingCart } from 'lucide-react'
import { supabase } from './supabase'
import './analysis.css'

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const money = (value) => new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(Number(value) || 0)
const formatDate = (value) => value ? new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T00:00:00`)) : '–'

export default function VariableAnalysis() {
  const now = new Date()
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: expData, error: expError }, { data: catData, error: catError }] = await Promise.all([
      supabase.from('expenses').select('*').eq('expense_type', 'Variable Kosten').order('next_payment_date', { ascending:false }),
      supabase.from('categories').select('*').order('sort_order', { ascending:true })
    ])
    if (expError || catError) alert(`Supabase-Fehler: ${(expError || catError).message}`)
    setExpenses((expData || []).filter(e => e.payment_interval === 'Einzelausgabe'))
    setCategories(catData || [])
    setLoading(false)
  }

  const categoryById = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories])

  const years = useMemo(() => {
    const set = new Set([now.getFullYear()])
    expenses.forEach(e => {
      if (e.next_payment_date) set.add(Number(e.next_payment_date.slice(0,4)))
    })
    return [...set].sort((a,b)=>b-a)
  }, [expenses])

  const monthly = useMemo(() => MONTHS.map((name, index) => {
    const items = expenses.filter(e => {
      if (!e.next_payment_date) return false
      const d = new Date(`${e.next_payment_date}T00:00:00`)
      return d.getFullYear() === Number(year) && d.getMonth() === index
    })
    return { name, index, items, total: items.reduce((sum, e) => sum + Number(e.amount || 0), 0) }
  }), [expenses, year])

  const selected = monthly[month]
  const yearTotal = monthly.reduce((sum, m) => sum + m.total, 0)
  const monthsWithData = monthly.filter(m => m.total > 0).length
  const average = monthsWithData ? yearTotal / monthsWithData : 0
  const max = Math.max(1, ...monthly.map(m => m.total))

  const byCategory = useMemo(() => {
    const totals = {}
    selected.items.forEach(e => {
      const name = categoryById[e.category_id] || 'Ohne Kategorie'
      totals[name] = (totals[name] || 0) + Number(e.amount || 0)
    })
    return Object.entries(totals).map(([name,total]) => ({name,total})).sort((a,b)=>b.total-a.total)
  }, [selected, categoryById])

  return <>
    <section className="metric-grid">
      <Metric icon={<CalendarDays/>} label={`${MONTHS[month]} ${year}`} value={money(selected.total)} />
      <Metric icon={<BarChart3/>} label={`Gesamt ${year}`} value={money(yearTotal)} />
      <Metric icon={<ShoppingCart/>} label="Monatsdurchschnitt" value={money(average)} />
    </section>

    <section className="card">
      <div className="card-head analysis-head">
        <div>
          <h2>Variable Kosten nach Monat</h2>
          <p className="muted" style={{margin:'5px 0 0'}}>Klicke auf einen Monat, um die einzelnen Ausgaben zu sehen.</p>
        </div>
        <label className="field analysis-year">
          <span>Jahr</span>
          <select value={year} onChange={e=>setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {loading ? <p className="muted">Auswertung wird geladen …</p> : (
        <div className="month-analysis-grid">
          {monthly.map(m => (
            <button key={m.name} className={`month-analysis-card ${month === m.index ? 'active' : ''}`} onClick={()=>setMonth(m.index)}>
              <div className="month-analysis-top"><strong>{m.name.slice(0,3)}</strong><span>{money(m.total)}</span></div>
              <div className="month-analysis-track"><div className="month-analysis-fill" style={{width:`${m.total ? Math.max(5, (m.total/max)*100) : 0}%`}} /></div>
              <small>{m.items.length} {m.items.length === 1 ? 'Ausgabe' : 'Ausgaben'}</small>
            </button>
          ))}
        </div>
      )}
    </section>

    <section className="two-col">
      <section className="card">
        <div className="card-head"><h2>{MONTHS[month]} nach Kategorie</h2></div>
        {!byCategory.length ? <p className="muted">Für diesen Monat sind noch keine variablen Ausgaben erfasst.</p> : (
          <div className="category-bars">
            {byCategory.map(c => (
              <div className="bar-row" key={c.name}>
                <div className="bar-label"><span>{c.name}</span><strong>{money(c.total)}</strong></div>
                <div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(6,(c.total/selected.total)*100)}%`}} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Ausgaben im {MONTHS[month]}</h2></div>
        {!selected.items.length ? <p className="muted">Keine Einzelausgaben vorhanden.</p> : (
          <div className="list">
            {selected.items.map(item => (
              <div className="list-item" key={item.id}>
                <div className="list-icon">{(item.name || '?').slice(0,1).toUpperCase()}</div>
                <div className="list-main">
                  <strong>{item.name}</strong>
                  <span>{categoryById[item.category_id] || 'Ohne Kategorie'} · {formatDate(item.next_payment_date)}</span>
                  {item.payment_method && <span className="list-extra">{item.payment_method}</span>}
                </div>
                <div className="list-amount">{money(item.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  </>
}

function Metric({icon,label,value}) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>
}
