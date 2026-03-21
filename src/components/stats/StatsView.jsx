import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { LEGAL_ORDERS, TOPICS, TOPIC_COLORS } from '../../constants'

const COLORS = ['#c8a850', '#4a7ab0', '#7aaad0', '#3a7a50', '#b04a7a', '#7a4ab0', '#b07a4a', '#4ab07a']

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: '#151825',
      border: '1px solid #2a3050',
      borderRadius: '12px',
      padding: '20px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '32px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: '#c8a850' }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#8899bb', marginTop: '4px' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: '#4a5a70', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#1a2035', border: '1px solid #2a3050', borderRadius: '8px', color: '#e0d8c8', fontSize: '13px' },
  labelStyle: { color: '#c8a850' },
  cursor: { fill: 'rgba(200,168,80,0.06)' },
}

export function StatsView({ books }) {
  const stats = useMemo(() => {
    if (!books.length) return null

    const total = books.length
    const avgRating = (books.reduce((s, b) => s + (b.rating || 0), 0) / total).toFixed(1)
    const withPdf = books.filter(b => b.format === 'pdf' || b.format === 'both').length
    const pdfPct = Math.round((withPdf / total) * 100)

    const byLegalOrder = LEGAL_ORDERS.map(lo => ({
      name: lo,
      count: books.filter(b => (b.legalOrder || []).includes(lo)).length,
    })).filter(d => d.count > 0).sort((a, b) => b.count - a.count)

    const byTopic = TOPICS.map(t => ({
      name: t,
      count: books.filter(b => (b.topics || []).includes(t)).length,
    })).filter(d => d.count > 0).sort((a, b) => b.count - a.count)

    const formatMap = { paper: 0, pdf: 0, both: 0 }
    books.forEach(b => { if (b.format in formatMap) formatMap[b.format]++ })
    const byFormat = [
      { name: 'Бумага', value: formatMap.paper },
      { name: 'PDF', value: formatMap.pdf },
      { name: 'Бумага+PDF', value: formatMap.both },
    ].filter(d => d.value > 0)

    const yearMap = {}
    books.forEach(b => {
      const y = b.createdAt ? new Date(b.createdAt).getFullYear() : null
      if (y) yearMap[y] = (yearMap[y] || 0) + 1
    })
    const byYear = Object.entries(yearMap).sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }))

    return { total, avgRating, withPdf, pdfPct, byLegalOrder, byTopic, byFormat, byYear }
  }, [books])

  if (!books.length) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px', color: '#4a5a70', fontSize: '16px' }}>
        Добавьте книги, чтобы увидеть статистику
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <StatCard label="Книг в каталоге" value={stats.total} />
        <StatCard label="Средняя оценка" value={`${stats.avgRating}★`} />
        <StatCard label="С PDF" value={stats.withPdf} sub={`${stats.pdfPct}% каталога`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* By legal order */}
        <div style={{ background: '#151825', border: '1px solid #2a3050', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontFamily: "'Cormorant Garamond', serif", color: '#e0d8c8' }}>
            По правопорядку
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.byLegalOrder} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3050" />
              <XAxis type="number" tick={{ fill: '#4a5a70', fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8899bb', fontSize: 11 }} width={90} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#c8a850" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By topic */}
        <div style={{ background: '#151825', border: '1px solid #2a3050', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontFamily: "'Cormorant Garamond', serif", color: '#e0d8c8' }}>
            По темам
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.byTopic} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3050" />
              <XAxis type="number" tick={{ fill: '#4a5a70', fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8899bb', fontSize: 11 }} width={120} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#4a7ab0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By format */}
        <div style={{ background: '#151825', border: '1px solid #2a3050', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontFamily: "'Cormorant Garamond', serif", color: '#e0d8c8' }}>
            По формату
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.byFormat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {stats.byFormat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By year added */}
        {stats.byYear.length > 0 && (
          <div style={{ background: '#151825', border: '1px solid #2a3050', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontFamily: "'Cormorant Garamond', serif", color: '#e0d8c8' }}>
              Добавлено по годам
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.byYear}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3050" />
                <XAxis dataKey="year" tick={{ fill: '#8899bb', fontSize: 11 }} />
                <YAxis tick={{ fill: '#4a5a70', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="#3a7a50" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
