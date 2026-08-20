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

function PasswordEyeEnhancer() {
  useEffect(() => {
    const eyeSvg = `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696C3.77 7.593 7.288 5 12 5c4.712 0 8.23 2.593 9.938 6.652a1 1 0 0 1 0 .696C20.23 16.407 16.712 19 12 19c-4.712 0-8.23-2.593-9.938-6.652Z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>`
    const eyeOffSvg = `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m2 2 20 20"/>
        <path d="M6.71 6.71C4.9 7.9 3.48 9.58 2.62 11.65a1 1 0 0 0 0 .7C4.32 16.4 7.84 19 12 19c1.5 0 2.87-.29 4.08-.82"/>
        <path d="M10.73 5.08A9.7 9.7 0 0 1 12 5c4.16 0 7.68 2.6 9.38 6.65a1 1 0 0 1 0 .7 11.2 11.2 0 0 1-2.09 3.24"/>
        <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/>
      </svg>`

    const enhance = () => {
      document.querySelectorAll('.auth-card input[type="password"], .auth-card input[data-password-visible="true"]').forEach(input => {
        if (input.dataset.eyeReady === 'true') return
        input.dataset.eyeReady = 'true'

        const field = input.closest('.field')
        if (!field) return
        field.style.position = 'relative'
        input.style.paddingRight = '52px'

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'password-eye-toggle'
        button.setAttribute('aria-label', 'Passwort anzeigen')
        button.setAttribute('title', 'Passwort anzeigen')
        button.innerHTML = eyeSvg
        Object.assign(button.style, {
          position: 'absolute',
          right: '14px',
          bottom: '12px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '0',
          background: 'transparent',
          color: '#475569',
          padding: '0',
          cursor: 'pointer',
          zIndex: '2'
        })

        button.addEventListener('click', () => {
          const show = input.type === 'password'
          input.type = show ? 'text' : 'password'
          if (show) input.dataset.passwordVisible = 'true'
          else delete input.dataset.passwordVisible
          button.innerHTML = show ? eyeOffSvg : eyeSvg
          button.setAttribute('aria-label', show ? 'Passwort ausblenden' : 'Passwort anzeigen')
          button.setAttribute('title', show ? 'Passwort ausblenden' : 'Passwort anzeigen')
          input.focus()
        })

        field.appendChild(button)
      })
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}

function PureMonthlyCostsEnhancer({ active }) {
  useEffect(() => {
    if (!active || !supabase) return

    let currentValue = null
    let cancelled = false

    const formatCurrency = (value) => new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value)

    const renderCards = () => {
      if (cancelled || currentValue === null) return
      const grid = document.querySelector('.metric-grid')
      if (!grid) return

      let costCard = document.querySelector('[data-pure-monthly-costs="true"]')
      if (!costCard) {
        costCard = document.createElement('div')
        costCard.className = 'metric-card'
        costCard.dataset.pureMonthlyCosts = 'true'
        costCard.innerHTML = '<div class="metric-icon">€</div><span>Reine Monatskosten</span><strong></strong><small style="margin-top:6px;display:block;opacity:.72">Nur Ausgaben mit Intervall „monatlich“</small>'
        const firstMetric = grid.querySelector('.metric-card')
        if (firstMetric) firstMetric.insertAdjacentElement('afterend', costCard)
        else grid.appendChild(costCard)
      }
      const costValueNode = costCard.querySelector('strong')
      const formattedCosts = formatCurrency(currentValue)
      if (costValueNode && costValueNode.textContent !== formattedCosts) costValueNode.textContent = formattedCosts

      const incomeMetric = [...grid.querySelectorAll('.metric-card')]
        .find(card => card.querySelector('span')?.textContent?.trim() === 'Einnahmen / Monat')
      if (!incomeMetric) return
      const income = parseEuro(incomeMetric.querySelector('strong')?.textContent)
      const available = income - currentValue

      let availableCard = document.querySelector('[data-pure-monthly-available="true"]')
      if (!availableCard) {
        availableCard = document.createElement('div')
        availableCard.className = `metric-card ${available >= 0 ? 'positive' : 'negative'}`
        availableCard.dataset.pureMonthlyAvailable = 'true'
        availableCard.innerHTML = '<div class="metric-icon">€</div><span>Verfügbar – nur Monatskosten</span><strong></strong><small style="margin-top:6px;display:block;opacity:.72">Ohne jährliche, halbjährliche, quartalsweise und zweimonatliche Kosten</small>'
        costCard.insertAdjacentElement('afterend', availableCard)
      }
      availableCard.classList.toggle('positive', available >= 0)
      availableCard.classList.toggle('negative', available < 0)
      const availableValueNode = availableCard.querySelector('strong')
      const formattedAvailable = formatCurrency(available)
      if (availableValueNode && availableValueNode.textContent !== formattedAvailable) availableValueNode.textContent = formattedAvailable
    }

    const load = async () => {
      const { data, error } = await supabase.from('expenses').select('*')
      if (cancelled) return
      if (error) {
        console.error('Reine Monatskosten konnten nicht geladen werden:', error)
        return
      }

      currentValue = (data || [])
        .filter(expense => expense.payment_interval === 'monatlich')
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

      renderCards()
    }

    load()
    const observer = new MutationObserver(renderCards)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('focus', load)

    return () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener('focus', load)
      document.querySelector('[data-pure-monthly-costs="true"]')?.remove()
      document.querySelector('[data-pure-monthly-available="true"]')?.remove()
    }
  }, [active])

  return null
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
    <PasswordEyeEnhancer />
    <PureMonthlyCostsEnhancer active={Boolean(session)} />
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
