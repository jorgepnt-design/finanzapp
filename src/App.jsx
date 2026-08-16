import React, { useMemo, useState } from 'react'
import {
  Home, ReceiptText, Tags, Settings, Plus, Trash2, Pencil,
  WalletCards, TrendingUp, Landmark, LogIn, LogOut, X
} from 'lucide-react'
import { supabase } from './supabase'

const DEFAULT_CATEGORIES = [
  'Wohnen','Wohnnebenkosten','Auto & Mobilität','Versicherungen',
  'Altersvorsorge','Lebensmittel','Abonnements','Gesundheit',
  'Freizeit','Rücklagen','Sonstiges'
]

const demoExpenses = [
  {id:'e1', name:'Immobilienkredit', amount:1000, interval:'monatlich', category:'Wohnen', type:'Fixkosten'},
  {id:'e2', name:'Strom', amount:85, interval:'monatlich', category:'Wohnnebenkosten', type:'Fixkosten'},
  {id:'e3', name:'Kfz-Versicherung', amount:600, interval:'jährlich', category:'Versicherungen', type:'Fixkosten'},
  {id:'e4', name:'ETF-Sparplan', amount:300, interval:'monatlich', category:'Altersvorsorge', type:'Sparen'}
]

const demoIncome = [
  {id:'i1', name:'Einkommen', amount:3500, interval:'monatlich'}
]

const intervalToMonthly = (amount, interval) => {
  const a = Number(amount) || 0
  if (interval === 'jährlich') return a / 12
  if (interval === 'halbjährlich') return a / 6
  if (interval === 'quartalsweise') return a / 3
  if (interval === 'alle 2 Monate') return a / 2
  return a
}

function useLocalState(key, initialValue) {
  const [state, setState] = useState(() => {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : initialValue
  })
  const update = (value) => {
    const next = typeof value === 'function' ? value(state) : value
    setState(next)
    localStorage.setItem(key, JSON.stringify(next))
  }
  return [state, update]
}

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [categories, setCategories] = useLocalState('fb_categories', DEFAULT_CATEGORIES)
  const [expenses, setExpenses] = useLocalState('fb_expenses', demoExpenses)
  const [incomes, setIncomes] = useLocalState('fb_incomes', demoIncome)
  const [modal, setModal] = useState(null)
  const [editCategory, setEditCategory] = useState(null)
  const [sessionEmail, setSessionEmail] = useState(null)

  const monthlyExpenses = useMemo(
    () => expenses.reduce((s, e) => s + intervalToMonthly(e.amount, e.interval), 0),
    [expenses]
  )
  const monthlyIncome = useMemo(
    () => incomes.reduce((s, i) => s + intervalToMonthly(i.amount, i.interval), 0),
    [incomes]
  )
  const annualExpenses = monthlyExpenses * 12
  const available = monthlyIncome - monthlyExpenses
  const fixed = expenses.filter(e => e.type === 'Fixkosten')
    .reduce((s,e) => s + intervalToMonthly(e.amount,e.interval),0)

  const categoryTotals = useMemo(() => {
    return categories.map(c => ({
      name: c,
      value: expenses.filter(e=>e.category===c)
        .reduce((s,e)=>s+intervalToMonthly(e.amount,e.interval),0)
    })).filter(x=>x.value>0).sort((a,b)=>b.value-a.value)
  }, [categories, expenses])

  const currency = (v) => new Intl.NumberFormat('de-DE', {
    style:'currency', currency:'EUR'
  }).format(v)

  async function simpleLogin() {
    if (!supabase) {
      alert('Supabase ist noch nicht eingerichtet. Die App läuft aktuell lokal im Browser.')
      return
    }
    const email = prompt('E-Mail-Adresse')
    if (!email) return
    const password = prompt('Passwort')
    if (!password) return
    let { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const signup = confirm('Login fehlgeschlagen. Neues Konto mit diesen Daten erstellen?')
      if (!signup) return
      const res = await supabase.auth.signUp({ email, password })
      if (res.error) return alert(res.error.message)
      setSessionEmail(email)
      alert('Konto angelegt. Prüfe ggf. deine E-Mail zur Bestätigung.')
      return
    }
    setSessionEmail(data.user?.email || email)
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setSessionEmail(null)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FB</div>
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
            <h1>{tab === 'dashboard' ? 'Dashboard' :
                 tab === 'expenses' ? 'Ausgaben' :
                 tab === 'categories' ? 'Kategorien' : 'Einstellungen'}</h1>
          </div>
          <div className="top-actions">
            {sessionEmail ? (
              <button className="ghost" onClick={logout}><LogOut size={18}/> Abmelden</button>
            ) : (
              <button className="ghost" onClick={simpleLogin}><LogIn size={18}/> Login</button>
            )}
            <button className="primary" onClick={()=>setModal('expense')}><Plus size={18}/> Ausgabe</button>
          </div>
        </header>

        {tab === 'dashboard' && (
          <>
            <section className="metric-grid">
              <Metric icon={<ReceiptText/>} label="Monatliche Kosten" value={currency(monthlyExpenses)} />
              <Metric icon={<TrendingUp/>} label="Jährliche Kosten" value={currency(annualExpenses)} />
              <Metric icon={<WalletCards/>} label="Einnahmen / Monat" value={currency(monthlyIncome)} />
              <Metric icon={<Landmark/>} label="Verfügbar" value={currency(available)} emphasis={available >= 0 ? 'positive':'negative'} />
            </section>

            <section className="two-col">
              <Card title="Kosten nach Kategorie">
                <div className="category-bars">
                  {categoryTotals.map(c => (
                    <div key={c.name} className="bar-row">
                      <div className="bar-label"><span>{c.name}</span><strong>{currency(c.value)}</strong></div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{width:`${Math.max(6,(c.value/monthlyExpenses)*100)}%`}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Monatliche Übersicht">
                <div className="summary-list">
                  <SummaryRow label="Fixkosten" value={currency(fixed)} />
                  <SummaryRow label="Sonstige Kosten / Sparen" value={currency(monthlyExpenses-fixed)} />
                  <SummaryRow label="Fixkostenquote" value={monthlyIncome ? `${Math.round(fixed/monthlyIncome*100)} %` : '–'} />
                  <SummaryRow label="Übrig nach allen Kosten" value={currency(available)} strong />
                </div>
                <button className="secondary full" onClick={()=>setModal('income')}><Plus size={17}/> Einnahme hinzufügen</button>
              </Card>
            </section>
          </>
        )}

        {tab === 'expenses' && (
          <Card title="Alle Ausgaben" action={<button className="secondary" onClick={()=>setModal('expense')}><Plus size={17}/> Neu</button>}>
            <div className="list">
              {expenses.map(e => (
                <div className="list-item" key={e.id}>
                  <div className="list-icon">{e.name.slice(0,1).toUpperCase()}</div>
                  <div className="list-main">
                    <strong>{e.name}</strong>
                    <span>{e.category} · {e.interval} · {e.type}</span>
                  </div>
                  <div className="list-amount">{currency(e.amount)}</div>
                  <button className="icon-btn danger" onClick={()=>setExpenses(expenses.filter(x=>x.id!==e.id))}><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'categories' && (
          <Card title="Kategorien" action={<button className="secondary" onClick={()=>setEditCategory({mode:'new', value:''})}><Plus size={17}/> Kategorie</button>}>
            <p className="muted">Du kannst Kategorien frei hinzufügen, umbenennen und löschen.</p>
            <div className="chip-grid">
              {categories.map(c => (
                <div className="category-chip" key={c}>
                  <span>{c}</span>
                  <button className="icon-btn" onClick={()=>setEditCategory({mode:'edit', value:c})}><Pencil size={16}/></button>
                  <button className="icon-btn danger" onClick={()=>{
                    const used = expenses.some(e=>e.category===c)
                    if (used) return alert('Diese Kategorie wird noch verwendet. Verschiebe oder lösche zuerst die zugehörigen Ausgaben.')
                    if (confirm(`Kategorie "${c}" löschen?`)) setCategories(categories.filter(x=>x!==c))
                  }}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'settings' && (
          <section className="two-col">
            <Card title="Cloud & Konto">
              <p className="muted">
                {supabase
                  ? 'Supabase ist konfiguriert. Login und Cloud-Synchronisierung können aktiviert werden.'
                  : 'Noch keine Supabase-Konfiguration hinterlegt. Bis dahin speichert Version 1 lokal auf diesem Gerät.'}
              </p>
              <button className="secondary full" onClick={sessionEmail ? logout : simpleLogin}>
                {sessionEmail ? <><LogOut size={17}/> Abmelden ({sessionEmail})</> : <><LogIn size={17}/> Login / Konto erstellen</>}
              </button>
            </Card>
            <Card title="Datensicherung">
              <button className="secondary full" onClick={()=>{
                const data = JSON.stringify({categories, expenses, incomes}, null, 2)
                const blob = new Blob([data], {type:'application/json'})
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href=url; a.download='finanzblick-backup.json'; a.click()
                URL.revokeObjectURL(url)
              }}>Backup als JSON exportieren</button>
              <button className="danger-outline full" onClick={()=>{
                if(!confirm('Wirklich alle lokalen Daten zurücksetzen?')) return
                localStorage.clear()
                location.reload()
              }}>Lokale Daten zurücksetzen</button>
            </Card>
          </section>
        )}
      </main>

      <nav className="mobile-nav">
        <MobileBtn active={tab==='dashboard'} onClick={()=>setTab('dashboard')} icon={<Home/>} text="Home"/>
        <MobileBtn active={tab==='expenses'} onClick={()=>setTab('expenses')} icon={<ReceiptText/>} text="Ausgaben"/>
        <button className="mobile-add" onClick={()=>setModal('expense')}><Plus/></button>
        <MobileBtn active={tab==='categories'} onClick={()=>setTab('categories')} icon={<Tags/>} text="Kategorien"/>
        <MobileBtn active={tab==='settings'} onClick={()=>setTab('settings')} icon={<Settings/>} text="Mehr"/>
      </nav>

      {modal === 'expense' && (
        <ExpenseModal categories={categories} onClose={()=>setModal(null)} onSave={e=>{
          setExpenses([...expenses, {...e, id:crypto.randomUUID()}]); setModal(null)
        }}/>
      )}
      {modal === 'income' && (
        <IncomeModal onClose={()=>setModal(null)} onSave={i=>{
          setIncomes([...incomes, {...i, id:crypto.randomUUID()}]); setModal(null)
        }}/>
      )}
      {editCategory && (
        <CategoryModal data={editCategory} onClose={()=>setEditCategory(null)} onSave={(name)=>{
          const clean = name.trim()
          if(!clean) return
          if(editCategory.mode==='new') {
            if(!categories.includes(clean)) setCategories([...categories, clean])
          } else {
            setCategories(categories.map(c=>c===editCategory.value?clean:c))
            setExpenses(expenses.map(e=>e.category===editCategory.value?{...e, category:clean}:e))
          }
          setEditCategory(null)
        }}/>
      )}
    </div>
  )
}

function NavButton({active,onClick,icon,text}) {
  return <button className={`nav-btn ${active?'active':''}`} onClick={onClick}>{icon}<span>{text}</span></button>
}
function MobileBtn({active,onClick,icon,text}) {
  return <button className={`mobile-btn ${active?'active':''}`} onClick={onClick}>{icon}<small>{text}</small></button>
}
function Metric({icon,label,value,emphasis}) {
  return <div className={`metric-card ${emphasis||''}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>
}
function Card({title,children,action}) {
  return <section className="card"><div className="card-head"><h2>{title}</h2>{action}</div>{children}</section>
}
function SummaryRow({label,value,strong}) {
  return <div className={`summary-row ${strong?'strong':''}`}><span>{label}</span><b>{value}</b></div>
}

function ModalShell({title,onClose,children}) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
      {children}
    </div>
  </div>
}

function ExpenseModal({categories,onClose,onSave}) {
  const [form,setForm]=useState({name:'',amount:'',category:categories[0]||'Sonstiges',interval:'monatlich',type:'Fixkosten'})
  return <ModalShell title="Ausgabe hinzufügen" onClose={onClose}>
    <form onSubmit={e=>{e.preventDefault(); onSave({...form, amount:Number(form.amount)})}}>
      <Field label="Bezeichnung"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
      <Field label="Betrag"><input required type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></Field>
      <Field label="Kategorie"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field>
      <Field label="Intervall"><select value={form.interval} onChange={e=>setForm({...form,interval:e.target.value})}>
        {['monatlich','alle 2 Monate','quartalsweise','halbjährlich','jährlich'].map(x=><option key={x}>{x}</option>)}
      </select></Field>
      <Field label="Art"><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
        {['Fixkosten','Variable Kosten','Rücklage','Sparen'].map(x=><option key={x}>{x}</option>)}
      </select></Field>
      <button className="primary full" type="submit">Speichern</button>
    </form>
  </ModalShell>
}

function IncomeModal({onClose,onSave}) {
  const [form,setForm]=useState({name:'Einkommen',amount:'',interval:'monatlich'})
  return <ModalShell title="Einnahme hinzufügen" onClose={onClose}>
    <form onSubmit={e=>{e.preventDefault(); onSave({...form, amount:Number(form.amount)})}}>
      <Field label="Bezeichnung"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
      <Field label="Betrag"><input required type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></Field>
      <Field label="Intervall"><select value={form.interval} onChange={e=>setForm({...form,interval:e.target.value})}>
        {['monatlich','quartalsweise','halbjährlich','jährlich'].map(x=><option key={x}>{x}</option>)}
      </select></Field>
      <button className="primary full" type="submit">Speichern</button>
    </form>
  </ModalShell>
}

function CategoryModal({data,onClose,onSave}) {
  const [name,setName]=useState(data.value)
  return <ModalShell title={data.mode==='new'?'Kategorie hinzufügen':'Kategorie bearbeiten'} onClose={onClose}>
    <form onSubmit={e=>{e.preventDefault(); onSave(name)}}>
      <Field label="Name"><input autoFocus required value={name} onChange={e=>setName(e.target.value)}/></Field>
      <button className="primary full" type="submit">Speichern</button>
    </form>
  </ModalShell>
}

function Field({label,children}) {
  return <label className="field"><span>{label}</span>{children}</label>
}
