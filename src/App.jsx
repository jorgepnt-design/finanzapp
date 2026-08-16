import React, { useEffect, useMemo, useState } from 'react'
import {
  Home, ReceiptText, Tags, Settings, Plus, Trash2, Pencil,
  WalletCards, TrendingUp, Landmark, LogOut, X, Cloud, ShieldCheck, ShoppingBag
} from 'lucide-react'
import { supabase } from './supabase'
import './auth.css'

const DEFAULT_CATEGORIES = [
  'Wohnen','Wohnnebenkosten','Auto & Mobilität','Versicherungen',
  'Altersvorsorge','Lebensmittel','Abonnements','Gesundheit',
  'Freizeit','Rücklagen','Sonstiges'
]

const isOneTimeExpense = (expense) => expense.interval === 'einmalig' || expense.type === 'Einmalige Ausgabe'

const intervalToMonthly = (amount, interval) => {
  const a = Number(amount) || 0
  if (interval === 'einmalig') return 0
  if (interval === 'jährlich') return a / 12
  if (interval === 'halbjährlich') return a / 6
  if (interval === 'quartalsweise') return a / 3
  if (interval === 'alle 2 Monate') return a / 2
  return a
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncState, setSyncState] = useState('')
  const [tab, setTab] = useState('dashboard')
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [modal, setModal] = useState(null)
  const [editCategory, setEditCategory] = useState(null)
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all')

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      setCategories([])
      setExpenses([])
      setIncomes([])
      return
    }
    loadCloudData(session.user.id)
  }, [session?.user?.id])

  async function loadCloudData(userId) {
    setLoading(true)
    setSyncState('Synchronisiere …')
    try {
      let { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (catError) throw catError

      if (!catData?.length) {
        const defaults = DEFAULT_CATEGORIES.map((name, index) => ({
          user_id: userId,
          name,
          sort_order: index,
          active: true
        }))
        const created = await supabase.from('categories').insert(defaults).select('*')
        if (created.error) throw created.error
        catData = created.data
      }

      const [{ data: expData, error: expError }, { data: incData, error: incError }] = await Promise.all([
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('incomes').select('*').order('created_at', { ascending: false })
      ])
      if (expError) throw expError
      if (incError) throw incError

      setCategories(catData || [])
      setExpenses((expData || []).map(fromDbExpense))
      setIncomes((incData || []).map(fromDbIncome))
      setSyncState('✓ Synchronisiert')
    } catch (err) {
      console.error(err)
      setSyncState('Synchronisierung fehlgeschlagen')
      alert(`Supabase-Fehler: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c.name])),
    [categories]
  )

  const recurringExpenses = useMemo(() => expenses.filter(e => !isOneTimeExpense(e)), [expenses])
  const oneTimeExpenses = useMemo(() => expenses.filter(isOneTimeExpense), [expenses])
  const filteredExpenses = useMemo(
    () => expenseCategoryFilter === 'all'
      ? expenses
      : expenses.filter(e => e.categoryId === expenseCategoryFilter),
    [expenses, expenseCategoryFilter]
  )

  const monthlyExpenses = useMemo(
    () => recurringExpenses.reduce((s, e) => s + intervalToMonthly(e.amount, e.interval), 0),
    [recurringExpenses]
  )
  const monthlyIncome = useMemo(
    () => incomes.reduce((s, i) => s + intervalToMonthly(i.amount, i.interval), 0),
    [incomes]
  )
  const oneTimeTotal = useMemo(
    () => oneTimeExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [oneTimeExpenses]
  )
  const annualExpenses = monthlyExpenses * 12
  const available = monthlyIncome - monthlyExpenses
  const fixed = recurringExpenses.filter(e => e.type === 'Fixkosten')
    .reduce((s,e) => s + intervalToMonthly(e.amount,e.interval),0)
  const variable = recurringExpenses.filter(e => e.type === 'Variable Kosten')
    .reduce((s,e) => s + intervalToMonthly(e.amount,e.interval),0)
  const saving = recurringExpenses.filter(e => e.type === 'Rücklage' || e.type === 'Sparen')
    .reduce((s,e) => s + intervalToMonthly(e.amount,e.interval),0)

  const categoryTotals = useMemo(() => {
    return categories.map(c => ({
      name: c.name,
      value: recurringExpenses.filter(e => e.categoryId === c.id)
        .reduce((s,e)=>s+intervalToMonthly(e.amount,e.interval),0)
    })).filter(x=>x.value>0).sort((a,b)=>b.value-a.value)
  }, [categories, recurringExpenses])

  const currency = (v) => new Intl.NumberFormat('de-DE', {
    style:'currency', currency:'EUR'
  }).format(v)

  async function logout() {
    await supabase.auth.signOut()
  }

  async function saveExpense(expense) {
    if (!session?.user?.id) return
    setSyncState('Synchronisiere …')
    const payload = toDbExpense(expense, session.user.id)

    if (modal?.expense?.id) {
      const { data, error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', modal.expense.id)
        .select('*')
        .single()
      if (error) return showSyncError(error)
      setExpenses(items => items.map(item => item.id === data.id ? fromDbExpense(data) : item))
    } else {
      const { data, error } = await supabase.from('expenses').insert(payload).select('*').single()
      if (error) return showSyncError(error)
      setExpenses(items => [fromDbExpense(data), ...items])
    }
    setModal(null)
    setSyncState('✓ Synchronisiert')
  }

  async function deleteExpense(expense) {
    if (!confirm(`Ausgabe „${expense.name}“ wirklich löschen?`)) return
    setSyncState('Synchronisiere …')
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) return showSyncError(error)
    setExpenses(items => items.filter(x => x.id !== expense.id))
    setSyncState('✓ Synchronisiert')
  }

  async function saveIncome(income) {
    setSyncState('Synchronisiere …')
    const { data, error } = await supabase.from('incomes').insert({
      user_id: session.user.id,
      name: income.name,
      amount: Number(income.amount),
      payment_interval: income.interval,
      notes: income.notes || null
    }).select('*').single()
    if (error) return showSyncError(error)
    setIncomes(items => [fromDbIncome(data), ...items])
    setModal(null)
    setSyncState('✓ Synchronisiert')
  }

  async function saveCategory(name) {
    const clean = name.trim()
    if (!clean) return
    setSyncState('Synchronisiere …')

    if (editCategory.mode === 'new') {
      const { data, error } = await supabase.from('categories').insert({
        user_id: session.user.id,
        name: clean,
        active: true,
        sort_order: categories.length
      }).select('*').single()
      if (error) return showSyncError(error)
      setCategories(items => [...items, data])
    } else {
      const { data, error } = await supabase.from('categories')
        .update({ name: clean, updated_at: new Date().toISOString() })
        .eq('id', editCategory.category.id)
        .select('*')
        .single()
      if (error) return showSyncError(error)
      setCategories(items => items.map(c => c.id === data.id ? data : c))
    }
    setEditCategory(null)
    setSyncState('✓ Synchronisiert')
  }

  async function deleteCategory(category) {
    const used = expenses.some(e => e.categoryId === category.id)
    if (used) return alert('Diese Kategorie wird noch verwendet. Verschiebe oder lösche zuerst die zugehörigen Ausgaben.')
    if (!confirm(`Kategorie „${category.name}“ löschen?`)) return
    setSyncState('Synchronisiere …')
    const { error } = await supabase.from('categories').delete().eq('id', category.id)
    if (error) return showSyncError(error)
    setCategories(items => items.filter(c => c.id !== category.id))
    if (expenseCategoryFilter === category.id) setExpenseCategoryFilter('all')
    setSyncState('✓ Synchronisiert')
  }

  function showSyncError(error) {
    console.error(error)
    setSyncState('Synchronisierung fehlgeschlagen')
    alert(`Supabase-Fehler: ${error.message}`)
  }

  if (!authReady) return <LoadingScreen text="Anmeldung wird geprüft …" />
  if (!supabase) return <AuthUnavailable />
  if (!session) return <AuthScreen />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><img src="/finanzapp-icon-512.png" alt="FinanzBlick" className="brand-logo-image" /></div>
          <div><strong>FinanzBlick</strong><small>Meine Finanzen</small></div>
        </div>
        <nav>
          <NavButton active={tab==='dashboard'} onClick={()=>setTab('dashboard')} icon={<Home/>} text="Dashboard"/>
          <NavButton active={tab==='expenses'} onClick={()=>setTab('expenses')} icon={<ReceiptText/>} text="Ausgaben"/>
          <NavButton active={tab==='categories'} onClick={()=>setTab('categories')} icon={<Tags/>} text="Kategorien"/>
          <NavButton active={tab==='settings'} onClick={()=>setTab('settings')} icon={<Settings/>} text="Einstellungen"/>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Persönliche Finanzübersicht</p>
            <h1>{tab === 'dashboard' ? 'Dashboard' : tab === 'expenses' ? 'Ausgaben' : tab === 'categories' ? 'Kategorien' : 'Einstellungen'}</h1>
            <small className="sync-state"><Cloud size={14}/> {loading ? 'Synchronisiere …' : syncState}</small>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={logout}><LogOut size={18}/> Abmelden</button>
            <button className="primary" onClick={()=>setModal({type:'expense', expense:null})}><Plus size={18}/> Ausgabe</button>
          </div>
        </header>

        {tab === 'dashboard' && (
          <>
            <section className="metric-grid">
              <Metric icon={<ReceiptText/>} label="Laufende Kosten / Monat" value={currency(monthlyExpenses)} />
              <Metric icon={<TrendingUp/>} label="Laufende Kosten / Jahr" value={currency(annualExpenses)} />
              <Metric icon={<ShoppingBag/>} label="Einmalige Ausgaben" value={currency(oneTimeTotal)} />
              <Metric icon={<WalletCards/>} label="Einnahmen / Monat" value={currency(monthlyIncome)} />
              <Metric icon={<Landmark/>} label="Verfügbar nach laufenden Kosten" value={currency(available)} emphasis={available >= 0 ? 'positive':'negative'} />
            </section>
            <section className="two-col">
              <Card title="Laufende Kosten nach Kategorie">
                <div className="category-bars">
                  {categoryTotals.length ? categoryTotals.map(c => (
                    <div key={c.name} className="bar-row">
                      <div className="bar-label"><span>{c.name}</span><strong>{currency(c.value)}</strong></div>
                      <div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(6,(c.value/monthlyExpenses)*100)}%`}}/></div>
                    </div>
                  )) : <p className="muted">Noch keine laufenden Ausgaben vorhanden.</p>}
                </div>
              </Card>
              <Card title="Monatliche Übersicht">
                <div className="summary-list">
                  <SummaryRow label="Fixkosten" value={currency(fixed)} />
                  <SummaryRow label="Variable laufende Kosten" value={currency(variable)} />
                  <SummaryRow label="Rücklagen / Sparen" value={currency(saving)} />
                  <SummaryRow label="Fixkostenquote" value={monthlyIncome ? `${Math.round(fixed/monthlyIncome*100)} %` : '–'} />
                  <SummaryRow label="Übrig nach laufenden Kosten" value={currency(available)} strong />
                </div>
                <button className="secondary full" onClick={()=>setModal({type:'income'})}><Plus size={17}/> Einnahme hinzufügen</button>
              </Card>
            </section>
            <Card title="Einmalige Ausgaben">
              {!oneTimeExpenses.length ? <p className="muted">Noch keine einmaligen Ausgaben erfasst.</p> : (
                <div className="list">
                  {oneTimeExpenses.slice(0, 8).map(e => (
                    <div className="list-item" key={e.id}>
                      <div className="list-icon">{e.name.slice(0,1).toUpperCase()}</div>
                      <div className="list-main">
                        <strong>{e.name}</strong>
                        <span>{categoryById[e.categoryId] || 'Ohne Kategorie'}{e.nextPaymentDate ? ` · ${formatDate(e.nextPaymentDate)}` : ''}</span>
                      </div>
                      <div className="list-amount">{currency(e.amount)}</div>
                      <div className="list-actions">
                        <button className="icon-btn" title="Bearbeiten" onClick={()=>setModal({type:'expense', expense:e})}><Pencil size={18}/></button>
                        <button className="icon-btn danger" title="Löschen" onClick={()=>deleteExpense(e)}><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === 'expenses' && (
          <Card title="Alle Ausgaben" action={<button className="secondary" onClick={()=>setModal({type:'expense', expense:null})}><Plus size={17}/> Neu</button>}>
            <div style={{display:'flex', gap:'10px', alignItems:'end', flexWrap:'wrap', marginBottom:'18px'}}>
              <label className="field" style={{minWidth:'220px', maxWidth:'340px'}}>
                <span>Nach Kategorie filtern</span>
                <select value={expenseCategoryFilter} onChange={e=>setExpenseCategoryFilter(e.target.value)}>
                  <option value="all">Alle Kategorien</option>
                  {categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                </select>
              </label>
              {expenseCategoryFilter !== 'all' && (
                <button className="ghost" onClick={()=>setExpenseCategoryFilter('all')}>Filter zurücksetzen</button>
              )}
              <span className="muted" style={{marginBottom:'12px'}}>{filteredExpenses.length} von {expenses.length} Ausgaben</span>
            </div>
            <div className="list">
              {!expenses.length && <p className="muted">Noch keine Ausgaben gespeichert.</p>}
              {!!expenses.length && !filteredExpenses.length && <p className="muted">In dieser Kategorie sind noch keine Ausgaben gespeichert.</p>}
              {filteredExpenses.map(e => (
                <div className="list-item" key={e.id}>
                  <div className="list-icon">{e.name.slice(0,1).toUpperCase()}</div>
                  <div className="list-main">
                    <strong>{e.name}</strong>
                    <span>{categoryById[e.categoryId] || 'Ohne Kategorie'} · {e.interval} · {e.type}</span>
                    {(e.provider || e.nextPaymentDate) && <span className="list-extra">
                      {e.provider ? `Anbieter: ${e.provider}` : ''}{e.provider && e.nextPaymentDate ? ' · ' : ''}{e.nextPaymentDate ? `${isOneTimeExpense(e) ? 'Zahlungsdatum' : 'Nächste Zahlung'}: ${formatDate(e.nextPaymentDate)}` : ''}
                    </span>}
                  </div>
                  <div className="list-amount">{currency(e.amount)}</div>
                  <div className="list-actions">
                    <button className="icon-btn" title="Bearbeiten" onClick={()=>setModal({type:'expense', expense:e})}><Pencil size={18}/></button>
                    <button className="icon-btn danger" title="Löschen" onClick={()=>deleteExpense(e)}><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'categories' && (
          <Card title="Kategorien" action={<button className="secondary" onClick={()=>setEditCategory({mode:'new'})}><Plus size={17}/> Kategorie</button>}>
            <p className="muted">Kategorien gehören nur zu deinem Konto und werden mit Supabase synchronisiert.</p>
            <div className="chip-grid">
              {categories.map(c => (
                <div className="category-chip" key={c.id}>
                  <span>{c.name}</span>
                  <button className="icon-btn" onClick={()=>setEditCategory({mode:'edit', category:c})}><Pencil size={16}/></button>
                  <button className="icon-btn danger" onClick={()=>deleteCategory(c)}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'settings' && (
          <section className="two-col">
            <Card title="Cloud & Konto">
              <p className="muted"><ShieldCheck size={17}/> Angemeldet als <strong>{session.user.email}</strong>. Deine Finanzdaten werden aus deinem persönlichen Supabase-Konto geladen.</p>
              <button className="secondary full" onClick={logout}><LogOut size={17}/> Abmelden</button>
            </Card>
            <Card title="Datensicherung">
              <button className="secondary full" onClick={()=>exportBackup({categories, expenses, incomes})}>Backup als JSON exportieren</button>
            </Card>
          </section>
        )}
      </main>

      <nav className="mobile-nav">
        <MobileBtn active={tab==='dashboard'} onClick={()=>setTab('dashboard')} icon={<Home/>} text="Home"/>
        <MobileBtn active={tab==='expenses'} onClick={()=>setTab('expenses')} icon={<ReceiptText/>} text="Ausgaben"/>
        <button className="mobile-add" onClick={()=>setModal({type:'expense', expense:null})}><Plus/></button>
        <MobileBtn active={tab==='categories'} onClick={()=>setTab('categories')} icon={<Tags/>} text="Kategorien"/>
        <MobileBtn active={tab==='settings'} onClick={()=>setTab('settings')} icon={<Settings/>} text="Mehr"/>
      </nav>

      {modal?.type === 'expense' && <ExpenseModal categories={categories} expense={modal.expense} onClose={()=>setModal(null)} onSave={saveExpense}/>} 
      {modal?.type === 'income' && <IncomeModal onClose={()=>setModal(null)} onSave={saveIncome}/>} 
      {editCategory && <CategoryModal data={editCategory} onClose={()=>setEditCategory(null)} onSave={saveCategory}/>} 
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else if (!data.session) setMessage('Konto erstellt. Bitte bestätige die E-Mail und melde dich danach an.')
    }
    setBusy(false)
  }

  async function resetPassword() {
    if (!email) return setMessage('Bitte zuerst deine E-Mail-Adresse eingeben.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setMessage(error ? error.message : 'E-Mail zum Zurücksetzen des Passworts wurde versendet.')
  }

  return <div className="auth-page">
    <div className="auth-card">
      <div className="auth-logo"><img src="/finanzapp-icon-512.png" alt="FinanzBlick" className="auth-logo-image" /></div>
      <p className="eyebrow">FinanzBlick</p>
      <h1>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</h1>
      <p className="muted">Deine Finanzdaten sind erst nach der Anmeldung sichtbar und werden mit deinem persönlichen Supabase-Konto synchronisiert.</p>
      <form onSubmit={submit}>
        <Field label="E-Mail"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></Field>
        <Field label="Passwort"><input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></Field>
        {message && <div className="auth-message">{message}</div>}
        <button className="primary full" disabled={busy}>{busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</button>
      </form>
      {mode === 'login' && <button className="auth-link" onClick={resetPassword}>Passwort vergessen?</button>}
      <button className="auth-switch" onClick={()=>{ setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
        {mode === 'login' ? 'Noch kein Konto? Konto erstellen' : 'Bereits registriert? Anmelden'}
      </button>
    </div>
  </div>
}

function AuthUnavailable() {
  return <div className="auth-page"><div className="auth-card"><h1>Konfiguration fehlt</h1><p>Die Supabase-Umgebungsvariablen sind nicht verfügbar. Prüfe die Render-Einstellungen.</p></div></div>
}
function LoadingScreen({text}) { return <div className="auth-page"><div className="auth-card"><p>{text}</p></div></div> }
function NavButton({active,onClick,icon,text}) { return <button className={`nav-btn ${active?'active':''}`} onClick={onClick}>{icon}<span>{text}</span></button> }
function MobileBtn({active,onClick,icon,text}) { return <button className={`mobile-btn ${active?'active':''}`} onClick={onClick}>{icon}<small>{text}</small></button> }
function Metric({icon,label,value,emphasis}) { return <div className={`metric-card ${emphasis||''}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div> }
function Card({title,children,action}) { return <section className="card"><div className="card-head"><h2>{title}</h2>{action}</div>{children}</section> }
function SummaryRow({label,value,strong}) { return <div className={`summary-row ${strong?'strong':''}`}><span>{label}</span><b>{value}</b></div> }

function ModalShell({title,onClose,children}) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal expense-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>{children}</div></div>
}

function ExpenseModal({categories, expense, onClose, onSave}) {
  const [form,setForm]=useState({
    name: expense?.name || '', amount: expense?.amount ?? '', categoryId: expense?.categoryId || categories[0]?.id || '',
    interval: expense?.interval || 'monatlich', type: expense?.type || 'Fixkosten', provider: expense?.provider || '',
    contractNumber: expense?.contractNumber || '', paymentMethod: expense?.paymentMethod || '', nextPaymentDate: expense?.nextPaymentDate || '',
    cancellationDate: expense?.cancellationDate || '', notes: expense?.notes || ''
  })
  const set = (key, value) => setForm(prev => ({...prev, [key]:value}))
  const changeInterval = (value) => {
    setForm(prev => ({
      ...prev,
      interval: value,
      type: value === 'einmalig' ? 'Einmalige Ausgabe' : (prev.type === 'Einmalige Ausgabe' ? 'Variable Kosten' : prev.type)
    }))
  }
  const oneTime = form.interval === 'einmalig'

  return <ModalShell title={expense ? 'Ausgabe bearbeiten' : 'Ausgabe hinzufügen'} onClose={onClose}>
    <form onSubmit={e=>{e.preventDefault(); onSave({...form, amount:Number(form.amount)})}}>
      <div className="form-grid">
        <Field label="Bezeichnung"><input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="z. B. Klimaanlage"/></Field>
        <Field label="Betrag"><input required type="number" min="0" step="0.01" value={form.amount} onChange={e=>set('amount',e.target.value)}/></Field>
        <Field label="Kategorie"><select required value={form.categoryId} onChange={e=>set('categoryId',e.target.value)}>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Intervall"><select value={form.interval} onChange={e=>changeInterval(e.target.value)}>{['monatlich','alle 2 Monate','quartalsweise','halbjährlich','jährlich','einmalig'].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Art"><select value={form.type} onChange={e=>set('type',e.target.value)} disabled={oneTime}>{['Fixkosten','Variable Kosten','Rücklage','Sparen','Einmalige Ausgabe'].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Anbieter / Vertragspartner"><input value={form.provider} onChange={e=>set('provider',e.target.value)} placeholder={oneTime ? 'z. B. MediaMarkt, Bauhaus' : 'z. B. HUK24, Allianz, Entega'}/></Field>
        <Field label="Vertragsnummer / Beleg"><input value={form.contractNumber} onChange={e=>set('contractNumber',e.target.value)} /></Field>
        <Field label="Zahlungsart"><select value={form.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)}><option value="">Nicht angegeben</option>{['Lastschrift','Überweisung','Kreditkarte','PayPal','Bar','Sonstiges'].map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label={oneTime ? 'Kauf-/Zahlungsdatum' : 'Nächste Zahlung'}><input type="date" value={form.nextPaymentDate} onChange={e=>set('nextPaymentDate',e.target.value)}/></Field>
        {!oneTime && <Field label="Kündigungsdatum / Frist"><input type="date" value={form.cancellationDate} onChange={e=>set('cancellationDate',e.target.value)}/></Field>}
      </div>
      {oneTime && <p className="muted">Diese Ausgabe wird separat ausgewiesen und nicht in deine monatlichen oder jährlichen laufenden Kosten eingerechnet.</p>}
      <Field label="Notizen"><textarea rows="4" value={form.notes} onChange={e=>set('notes',e.target.value)} /></Field>
      <div className="modal-actions"><button className="ghost" type="button" onClick={onClose}>Abbrechen</button><button className="primary" type="submit">{expense ? 'Änderungen speichern' : 'Ausgabe speichern'}</button></div>
    </form>
  </ModalShell>
}

function IncomeModal({onClose,onSave}) {
  const [form,setForm]=useState({name:'Einkommen',amount:'',interval:'monatlich',notes:''})
  return <ModalShell title="Einnahme hinzufügen" onClose={onClose}><form onSubmit={e=>{e.preventDefault(); onSave({...form, amount:Number(form.amount)})}}>
    <Field label="Bezeichnung"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Betrag"><input required type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></Field>
    <Field label="Intervall"><select value={form.interval} onChange={e=>setForm({...form,interval:e.target.value})}>{['monatlich','quartalsweise','halbjährlich','jährlich'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Notiz"><textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
    <button className="primary full" type="submit">Speichern</button>
  </form></ModalShell>
}

function CategoryModal({data,onClose,onSave}) {
  const [name,setName]=useState(data.category?.name || '')
  return <ModalShell title={data.mode==='new'?'Kategorie hinzufügen':'Kategorie bearbeiten'} onClose={onClose}><form onSubmit={e=>{e.preventDefault(); onSave(name)}}><Field label="Name"><input autoFocus required value={name} onChange={e=>setName(e.target.value)}/></Field><button className="primary full" type="submit">Speichern</button></form></ModalShell>
}
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label> }
function formatDate(value) { if (!value) return ''; return new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T00:00:00`)) }
function fromDbExpense(e) { return { id:e.id, name:e.name, amount:Number(e.amount), categoryId:e.category_id, type:e.expense_type, interval:e.payment_interval, nextPaymentDate:e.next_payment_date || '', paymentMethod:e.payment_method || '', provider:e.provider || '', contractNumber:e.contract_number || '', cancellationDate:e.cancellation_date || '', notes:e.notes || '' } }
function toDbExpense(e, userId) { return { user_id:userId, category_id:e.categoryId || null, name:e.name, amount:Number(e.amount), expense_type:e.interval === 'einmalig' ? 'Einmalige Ausgabe' : e.type, payment_interval:e.interval, next_payment_date:e.nextPaymentDate || null, payment_method:e.paymentMethod || null, provider:e.provider || null, contract_number:e.contractNumber || null, cancellation_date:e.interval === 'einmalig' ? null : (e.cancellationDate || null), notes:e.notes || null, updated_at:new Date().toISOString() } }
function fromDbIncome(i) { return { id:i.id, name:i.name, amount:Number(i.amount), interval:i.payment_interval, notes:i.notes || '' } }
function exportBackup(data) { const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='finanzblick-backup.json'; a.click(); URL.revokeObjectURL(url) }
