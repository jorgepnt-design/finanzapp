import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, X, HandCoins, CircleCheck, Clock3 } from 'lucide-react'
import { supabase } from './supabase'

const currency = (v) => new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(Number(v) || 0)
const formatDate = (v) => v ? new Intl.DateTimeFormat('de-DE').format(new Date(`${v}T00:00:00`)) : '–'

export default function Loans() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('loans').select('*').order('created_at', { ascending:false })
    if (error) alert(`Supabase-Fehler: ${error.message}`)
    else setItems((data || []).map(fromDb))
    setLoading(false)
  }

  async function save(form) {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user?.id) return
    const payload = {
      user_id: auth.user.id,
      person_name: form.personName.trim(),
      amount_lent: Number(form.amountLent),
      amount_repaid: Number(form.amountRepaid || 0),
      lent_date: form.lentDate || null,
      due_date: form.dueDate || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString()
    }
    if (payload.amount_repaid > payload.amount_lent) return alert('Zurückgezahlt kann nicht höher als verliehen sein.')

    if (form.id) {
      const { data, error } = await supabase.from('loans').update(payload).eq('id', form.id).select('*').single()
      if (error) return alert(`Supabase-Fehler: ${error.message}`)
      setItems(list => list.map(x => x.id === data.id ? fromDb(data) : x))
    } else {
      const { data, error } = await supabase.from('loans').insert(payload).select('*').single()
      if (error) return alert(`Supabase-Fehler: ${error.message}`)
      setItems(list => [fromDb(data), ...list])
    }
    setModal(null)
  }

  async function remove(item) {
    if (!confirm(`Eintrag für „${item.personName}“ wirklich löschen?`)) return
    const { error } = await supabase.from('loans').delete().eq('id', item.id)
    if (error) return alert(`Supabase-Fehler: ${error.message}`)
    setItems(list => list.filter(x => x.id !== item.id))
  }

  const totals = useMemo(() => items.reduce((a, x) => {
    a.lent += x.amountLent
    a.repaid += x.amountRepaid
    a.open += Math.max(0, x.amountLent - x.amountRepaid)
    return a
  }, { lent:0, repaid:0, open:0 }), [items])

  return <>
    <section className="metric-grid">
      <LoanMetric icon={<HandCoins/>} label="Insgesamt verliehen" value={currency(totals.lent)} />
      <LoanMetric icon={<CircleCheck/>} label="Zurückgezahlt" value={currency(totals.repaid)} positive />
      <LoanMetric icon={<Clock3/>} label="Noch offen" value={currency(totals.open)} />
    </section>

    <section className="card">
      <div className="card-head">
        <div><h2>Verliehenes Geld</h2><p className="muted" style={{margin:'5px 0 0'}}>Pro Person siehst du verliehen, zurückgezahlt und den noch offenen Betrag.</p></div>
        <button className="secondary" onClick={()=>setModal({})}><Plus size={17}/> Neu</button>
      </div>

      {loading ? <p className="muted">Wird geladen …</p> : !items.length ? <p className="muted">Noch kein verliehenes Geld erfasst.</p> : (
        <div className="list">
          {items.map(item => {
            const open = Math.max(0, item.amountLent - item.amountRepaid)
            return <div className="list-item" key={item.id}>
              <div className="list-icon">{item.personName.slice(0,1).toUpperCase()}</div>
              <div className="list-main">
                <strong>{item.personName}</strong>
                <span>Verliehen: {currency(item.amountLent)} · Zurück: {currency(item.amountRepaid)}</span>
                <span className="list-extra">Verliehen am: {formatDate(item.lentDate)}{item.dueDate ? ` · Rückzahlung bis: ${formatDate(item.dueDate)}` : ''}</span>
                {item.notes && <span className="list-extra">{item.notes}</span>}
              </div>
              <div className="list-amount" style={{color: open === 0 ? '#047857' : undefined}}>{open === 0 ? 'Erledigt' : `${currency(open)} offen`}</div>
              <div className="list-actions">
                <button className="icon-btn" title="Bearbeiten" onClick={()=>setModal(item)}><Pencil size={18}/></button>
                <button className="icon-btn danger" title="Löschen" onClick={()=>remove(item)}><Trash2 size={18}/></button>
              </div>
            </div>
          })}
        </div>
      )}
    </section>

    {modal && <LoanModal loan={modal} onClose={()=>setModal(null)} onSave={save}/>} 
  </>
}

function LoanMetric({icon,label,value,positive}) {
  return <div className={`metric-card ${positive ? 'positive' : ''}`}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>
}

function LoanModal({loan,onClose,onSave}) {
  const [form, setForm] = useState({
    id: loan.id || '',
    personName: loan.personName || '',
    amountLent: loan.amountLent ?? '',
    amountRepaid: loan.amountRepaid ?? 0,
    lentDate: loan.lentDate || new Date().toISOString().slice(0,10),
    dueDate: loan.dueDate || '',
    notes: loan.notes || ''
  })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))
  const open = Math.max(0, Number(form.amountLent || 0) - Number(form.amountRepaid || 0))

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><h2>{loan.id ? 'Verliehenes Geld bearbeiten' : 'Verliehenes Geld erfassen'}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>
      <form onSubmit={e=>{e.preventDefault(); onSave(form)}}>
        <Field label="Person"><input required value={form.personName} onChange={e=>set('personName',e.target.value)} placeholder="Name der Person"/></Field>
        <div className="form-grid">
          <Field label="Verliehener Betrag"><input required min="0" step="0.01" type="number" value={form.amountLent} onChange={e=>set('amountLent',e.target.value)}/></Field>
          <Field label="Bereits zurückgezahlt"><input min="0" step="0.01" type="number" value={form.amountRepaid} onChange={e=>set('amountRepaid',e.target.value)}/></Field>
          <Field label="Verliehen am"><input type="date" value={form.lentDate} onChange={e=>set('lentDate',e.target.value)}/></Field>
          <Field label="Rückzahlung bis"><input type="date" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)}/></Field>
        </div>
        <div className="summary-row strong"><span>Noch offen</span><b>{currency(open)}</b></div>
        <Field label="Notizen"><textarea rows="4" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="z. B. Ratenvereinbarung, Zweck …"/></Field>
        <div className="modal-actions"><button className="ghost" type="button" onClick={onClose}>Abbrechen</button><button className="primary" type="submit">Speichern</button></div>
      </form>
    </div>
  </div>
}

function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label> }
function fromDb(x) { return { id:x.id, personName:x.person_name, amountLent:Number(x.amount_lent), amountRepaid:Number(x.amount_repaid), lentDate:x.lent_date || '', dueDate:x.due_date || '', notes:x.notes || '' } }
