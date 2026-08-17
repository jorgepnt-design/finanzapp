import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ArrowLeft, BarChart3, HandCoins, RefreshCw } from 'lucide-react'
import App from './App'
import Loans from './Loans'
import VariableAnalysis from './VariableAnalysis'
import ReportActions from './ReportActions'
import { supabase } from './supabase'
import './styles.css'

function parseEuro(text = '') {
  const cleaned = text.replace(/\s/g, '').replace(/€/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}

async function ensureFinanzblickUser(session) {
  const userId = session?.user?.id
  if (!userId || !supabase) return

  const { error } = await supabase
    .from('finanzblick_users')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

  if (error) console.error('FinanzBlick-Aktivierung fehlgeschlagen:', error)
}

function QuotaEnhancer({ active }) {
  useEffect(() => {
    if (!active) return

    const update = () => {
      const rows = [...document.querySelectorAll('.summary-row')]
      const fixedQuotaRow = rows.find(row => row.querySelector('span')?.textContent?.trim() === 'Fixkostenquote')
      if (!fixedQuotaRow) return

      const metrics = [...document.querySelectorAll('.metric-card')]
      const incomeMetric = metrics.find(card => card.querySelector('span')?.textContent?.trim() === 'Einnahmen / Monat')
      const costMetric = metrics.find(card => card.querySelector('span')?.textContent?.trim() === 'Kosten aktueller Monat')
      if (!incomeMetric || !costMetric) return

      const income = parseEuro(incomeMetric.querySelector('strong')?.textContent)
      const costs = parseEuro(costMetric.querySelector('strong')?.textContent)
      const quota = income > 0 ? `${Math.round((costs / income) * 100)} %` : '–'

      let totalRow = document.querySelector('[data-total-cost-quota="true"]')
      if (!totalRow) {
        totalRow = document.createElement('div')
        totalRow.className = 'summary-row'
        totalRow.dataset.totalCostQuota = 'true'
        totalRow.innerHTML = '<span>Gesamtkostenquote</span><b></b>'
        fixedQuotaRow.insertAdjacentElement('afterend', totalRow)
      }

      const valueNode = totalRow.querySelector('b')
      if (valueNode && valueNode.textContent !== quota) valueNode.textContent = quota
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('focus', update)

    return () => {
      observer.disconnect()
      window.removeEventListener('focus', update)
      document.querySelector('[data-total-cost-quota="true"]')?.remove()
    }
  }, [active])

  return null
}

function Root() {
  const initialRoute = window.location.hash === '#verliehen'
    ? 'loans'
    : window.location.hash === '#auswertung'
      ? 'analysis'
      : 'app'

  const [session, setSession] = useState(null)
  const [route, setRoute] = useState(initialRoute)

  useEffect(() => {
    supabase?.auth.getSession().then(async ({ data }) => {
      const currentSession = data.session || null
      if (currentSession) await ensureFinanzblickUser(currentSession)
      setSession(currentSession)
    })

    const { data: listener } = supabase?.auth.onAuthStateChange(async (_event, nextSession) => {
      if (nextSession) await ensureFinanzblickUser(nextSession)
      setSession(nextSession)
    }) || { data:null }

    const onHash = () => {
      if (window.location.hash === '#verliehen') setRoute('loans')
      else if (window.location.hash === '#auswertung') setRoute('analysis')
      else setRoute('app')
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      listener?.subscription?.unsubscribe()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  function openLoans() {
    window.location.hash = 'verliehen'
  }

  function openAnalysis() {
    window.location.hash = 'auswertung'
  }

  function refreshData() {
    window.location.reload()
  }

  function back() {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setRoute('app')
  }

  if (route === 'loans' && session) {
    return <div className="loans-page">
      <header className="loans-page-head">
        <div className="loans-page-brand">
          <img src="/finanzapp-icon-512.png" alt="FinanzBlick" />
          <div><strong>FinanzBlick</strong><small>Verliehenes Geld</small></div>
        </div>
        <button className="ghost" onClick={back}><ArrowLeft size={18}/> Zurück</button>
      </header>
      <main className="loans-page-content">
        <p className="eyebrow">Persönliche Finanzübersicht</p>
        <h1>Verliehenes Geld</h1>
        <div style={{height:18}} />
        <Loans />
      </main>
      <ReportActions />
    </div>
  }

  if (route === 'analysis' && session) {
    return <div className="loans-page">
      <header className="loans-page-head">
        <div className="loans-page-brand">
          <img src="/finanzapp-icon-512.png" alt="FinanzBlick" />
          <div><strong>FinanzBlick</strong><small>Variable Kosten</small></div>
        </div>
        <button className="ghost" onClick={back}><ArrowLeft size={18}/> Zurück</button>
      </header>
      <main className="loans-page-content">
        <p className="eyebrow">Persönliche Finanzübersicht</p>
        <h1>Auswertung variable Kosten</h1>
        <div style={{height:18}} />
        <VariableAnalysis />
      </main>
      <ReportActions />
    </div>
  }

  return <>
    <App />
    <QuotaEnhancer active={Boolean(session)} />
    {session && <>
      <ReportActions />
      <div className="finance-shortcuts">
        <button className="refresh-shortcut" onClick={refreshData} title="Daten aktualisieren" aria-label="Daten aktualisieren"><RefreshCw size={20}/><span>Aktualisieren</span></button>
        <button className="analysis-shortcut" onClick={openAnalysis} title="Variable Kosten auswerten"><BarChart3 size={20}/><span>Auswertung</span></button>
        <button className="loan-shortcut" onClick={openLoans} title="Verliehenes Geld öffnen"><HandCoins size={20}/><span>Verliehen</span></button>
      </div>
    </>}
  </>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
