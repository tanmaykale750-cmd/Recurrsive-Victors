import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { LuZoomIn, LuZoomOut, LuMaximize2 } from 'react-icons/lu'
import { TODAY, fmt, fmtShort } from '../../lib/dates'
import { LANES, laneOf, nodeColor, kindLabel } from './model'
import Mark from './Mark'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/overlay'
import { cn } from '../../lib/cn'

const PAD = 28
const LANE_H = 60
const AXIS_H = 28
const LABEL_W = 136
const GUTTER = 92
const Z_MIN = 1
const Z_MAX = 10

export default function TimelineCanvas({ nodes, domain, selectedId, onSelect, hidden = [] }) {
  const scroller = useRef(null)
  const btns = useRef({})
  const drag = useRef({ moved: false })
  const anchor = useRef(null)
  const [vw, setVw] = useState(800)
  const [view, setView] = useState({ left: 0, width: 800 })
  const [z, setZ] = useState(2)
  const [hover, setHover] = useState(null)

  /* time domain from all entries, so filtering never reshapes the axis */
  const { start, spanDays, months } = useMemo(() => {
    const ds = domain.map((n) => dayjs(n.date))
    const first = ds.reduce((a, b) => (b.isBefore(a) ? b : a), TODAY)
    const last = ds.reduce((a, b) => (b.isAfter(a) ? b : a), TODAY)
    const s = first.startOf('month')
    const e = last.add(1, 'month').startOf('month')
    const ms = []
    for (let m = s; m.isBefore(e); m = m.add(1, 'month')) ms.push(m)
    return { start: s, spanDays: e.diff(s, 'day'), months: ms }
  }, [domain])

  const fit = Math.max(0.5, (vw - PAD * 2) / spanDays)
  const ppd = fit * z
  const W = Math.round(spanDays * ppd + PAD * 2)
  const xOf = useCallback((d) => PAD + (dayjs(d).diff(start, 'hour') / 24) * ppd, [start, ppd])

  const lanes = LANES.filter((l) => !hidden.includes(l.key))
  const H = lanes.length * LANE_H + AXIS_H

  /* place nodes: stack same-day nodes, show labels only where they fit */
  const placed = useMemo(() => {
    const out = []
    lanes.forEach((lane, li) => {
      const list = nodes.filter((n) => laneOf(n) === lane.key).map((n) => ({ n, x: xOf(n.date) })).sort((a, b) => a.x - b.x)
      let prev = null
      list.forEach((p) => {
        p.k = prev && p.x - prev.x < 14 ? prev.k + 1 : 0
        p.y = li * LANE_H + LANE_H / 2 + (p.k ? (p.k % 2 ? -1 : 1) * Math.ceil(p.k / 2) * 13 : 0)
        p.li = li
        prev = p
      })
      /* label to the right if it fits, otherwise to the left, otherwise hover only */
      let used = -Infinity
      list.forEach((p, i) => {
        const next = list[i + 1]
        const prevX = i ? list[i - 1].x : -Infinity
        p.label = null
        if (p.k !== 0 || (next && next.x - p.x < 14)) return
        const right = (next ? next.x : W) - p.x
        const left = p.x - Math.max(used, prevX, 0)
        if (right >= LABEL_W + 18) {
          p.label = 'right'
          used = p.x + LABEL_W + 14
        } else if (left >= LABEL_W + 18) {
          p.label = 'left'
          used = p.x + 8
        } else used = p.x + 8
      })
      out.push(...list)
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, xOf, W, hidden.join()])

  const links = useMemo(() => {
    const by = {}
    placed.forEach((p) => p.n.cls === 'conflict' && (by[p.n.id] = by[p.n.id] || []).push(p))
    return Object.values(by).filter((ps) => ps.length === 2)
  }, [placed])

  /* viewport tracking */
  useEffect(() => {
    const el = scroller.current
    const ro = new ResizeObserver(() => setVw(el.clientWidth))
    ro.observe(el)
    setVw(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const syncView = () => {
    const el = scroller.current
    if (el) setView({ left: el.scrollLeft, width: el.clientWidth })
  }
  useEffect(syncView, [W, vw])

  /* first paint: put today about 40% across */
  const centered = useRef(false)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || centered.current || vw < 100) return
    el.scrollLeft = xOf(TODAY) - el.clientWidth * 0.42
    centered.current = true
    syncView()
  }, [vw, xOf])

  /* keep the anchored date under the same screen x after zoom */
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !anchor.current) return
    const { day, at } = anchor.current
    el.scrollLeft = PAD + day * ppd - at
    anchor.current = null
    syncView()
  }, [ppd])

  const zoomTo = useCallback(
    (nz, at) => {
      const el = scroller.current
      const clamped = Math.max(Z_MIN, Math.min(Z_MAX, nz))
      if (!el || clamped === z) return
      const px = at ?? el.clientWidth / 2
      anchor.current = { day: (el.scrollLeft + px - PAD) / ppd, at: px }
      setZ(clamped)
    },
    [z, ppd],
  )

  /* Ctrl/⌘ + wheel zooms around the pointer */
  useEffect(() => {
    const el = scroller.current
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const at = e.clientX - el.getBoundingClientRect().left
      zoomTo(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), at)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [z, zoomTo])

  /* drag to pan (mouse); touch keeps native scrolling */
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = scroller.current
    drag.current = { x: e.clientX, sl: el.scrollLeft, moved: false }
    const move = (ev) => {
      const dx = ev.clientX - drag.current.x
      if (Math.abs(dx) > 4) drag.current.moved = true
      if (drag.current.moved) {
        el.style.cursor = 'grabbing'
        el.scrollLeft = drag.current.sl - dx
      }
    }
    const up = () => {
      el.style.cursor = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setTimeout(() => (drag.current.moved = false), 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* bring the selected node into view */
  useEffect(() => {
    const p = placed.find((q) => q.n.nodeId === selectedId)
    const el = scroller.current
    if (!p || !el) return
    if (p.x < el.scrollLeft + 40 || p.x > el.scrollLeft + el.clientWidth - 60) el.scrollTo({ left: p.x - el.clientWidth / 2, behavior: 'smooth' })
  }, [selectedId, placed])

  const ordered = useMemo(() => [...placed].sort((a, b) => a.x - b.x || a.li - b.li), [placed])
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    if (!ordered.length) return
    const i = ordered.findIndex((p) => p.n.nodeId === selectedId)
    const j = i < 0 ? 0 : Math.max(0, Math.min(ordered.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))
    const n = ordered[j].n
    onSelect(n)
    requestAnimationFrame(() => btns.current[n.nodeId]?.focus({ preventScroll: true }))
  }

  /* minimap */
  const mm = useRef(null)
  const onMiniDown = (e) => {
    const box = mm.current.getBoundingClientRect()
    const el = scroller.current
    const go = (cx) => (el.scrollLeft = ((cx - box.left) / box.width) * W - el.clientWidth / 2)
    go(e.clientX)
    const move = (ev) => go(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const todayX = xOf(TODAY)
  const hovered = placed.find((p) => p.n.nodeId === hover && !p.label)
  const tabStop = selectedId && placed.some((p) => p.n.nodeId === selectedId) ? selectedId : ordered[0]?.n.nodeId

  return (
    <div className="min-w-0">
      <div className="flex">
        {/* lane labels */}
        <div className="shrink-0 border-r border-line" style={{ width: GUTTER }} aria-hidden>
          {lanes.map((l) => (
            <div key={l.key} className="flex items-center border-b border-line/70 px-3 text-[12px] font-medium text-ink-2" style={{ height: LANE_H }}>
              {l.label}
            </div>
          ))}
          <div style={{ height: AXIS_H }} />
        </div>

        {/* scrollable track */}
        <div
          ref={scroller}
          onScroll={syncView}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          role="group"
          aria-label="Interactive case timeline. Use left and right arrow keys to move between entries. Ctrl plus scroll to zoom."
          className="relative min-w-0 flex-1 cursor-grab overflow-x-auto overflow-y-hidden select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="relative" style={{ width: W, height: H }}>
            {/* lane stripes */}
            {lanes.map((l, i) => (
              <div key={l.key} className={cn('absolute right-0 left-0 border-b border-line/70', i % 2 && 'bg-surface-2/40')} style={{ top: i * LANE_H, height: LANE_H }} />
            ))}
            {/* month grid + axis labels */}
            {months.map((m, i) => (
              <div key={m.valueOf()} className="absolute top-0 bottom-0 border-l border-line/60" style={{ left: xOf(m) }}>
                <span className="tabular absolute bottom-[7px] left-1.5 text-[11px] font-medium whitespace-nowrap text-ink-3">
                  {m.format(i === 0 || m.month() === 0 ? 'MMM YYYY' : 'MMM')}
                </span>
              </div>
            ))}
            {/* today */}
            <div className="pointer-events-none absolute top-0 z-[1] w-px bg-primary" style={{ left: todayX, height: H - AXIS_H }}>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b bg-primary px-1.5 text-[10px] leading-[15px] font-semibold whitespace-nowrap text-on-primary">
                Today
              </span>
            </div>
            {/* conflict links: two records, never merged */}
            {links.map(([a, b]) => (
              <div
                key={a.n.id}
                className="pointer-events-none absolute border-t-2 border-dashed border-danger/60"
                style={{ left: Math.min(a.x, b.x), width: Math.max(2, Math.abs(b.x - a.x)), top: a.li * LANE_H + LANE_H / 2 - 1 }}
              />
            ))}
            {/* nodes */}
            {placed.map((p) => {
              const sel = p.n.nodeId === selectedId
              return (
                <div key={p.n.nodeId}>
                  <button
                    ref={(el) => (btns.current[p.n.nodeId] = el)}
                    type="button"
                    tabIndex={p.n.nodeId === tabStop ? 0 : -1}
                    aria-pressed={sel}
                    aria-label={`${p.n.title}. ${kindLabel(p.n)}, ${fmt(p.n.date)}. Source ${p.n.doc}, page ${p.n.page}.`}
                    onClick={() => !drag.current.moved && onSelect(p.n)}
                    onMouseEnter={() => setHover(p.n.nodeId)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(p.n.nodeId)}
                    onBlur={() => setHover(null)}
                    className="group absolute z-[2] grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-offset-0"
                    style={{ left: p.x, top: p.y }}
                  >
                    <Mark n={p.n} selected={sel} />
                  </button>
                  {p.label && (p.label === 'right' ? p.x >= view.left - 4 : p.x <= view.left + view.width + 4) && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => !drag.current.moved && onSelect(p.n)}
                      className={cn('absolute z-[3] w-[136px] -translate-y-1/2 rounded px-1 transition-colors', p.label === 'left' ? 'text-right' : 'text-left', sel ? 'bg-primary-soft' : 'bg-surface/90 hover:bg-surface-2')}
                      style={{ left: p.label === 'left' ? p.x - 11 - LABEL_W : p.x + 11, top: p.y }}
                    >
                      <span className="tabular block text-[10.5px] leading-tight text-ink-3">{fmtShort(p.n.date)}</span>
                      <span className={cn('block truncate text-[12px] leading-snug', sel ? 'font-medium text-ink' : 'text-ink-2')}>{p.n.title}</span>
                    </button>
                  )}
                </div>
              )
            })}
            {/* hover card for nodes whose label did not fit */}
            {hovered && (
              <div
                className="animate-fade pointer-events-none absolute z-[5] w-[200px] -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-float"
                style={{ left: Math.min(Math.max(hovered.x, 104), W - 104), ...(hovered.li === 0 ? { top: hovered.y + 16 } : { top: hovered.y - 16, transform: 'translate(-50%, -100%)' }) }}
              >
                <span className="tabular block text-[10.5px] text-ink-3">{fmt(hovered.n.date)} · {kindLabel(hovered.n)}</span>
                <span className="block text-[12px] leading-snug text-ink">{hovered.n.title}</span>
              </div>
            )}
            {!nodes.length && <div className="absolute inset-x-0 top-0 grid place-items-center text-[13px] text-ink-3" style={{ height: H - AXIS_H, left: view.left, width: view.width }}>Nothing in the record matches these filters.</div>}
          </div>
        </div>
      </div>

      {/* minimap + zoom */}
      <div className="mt-2 flex items-center gap-3 border-t border-line pt-2">
        <div style={{ width: GUTTER - 12 }} className="eyebrow shrink-0 pl-3 max-sm:hidden">Overview</div>
        <div ref={mm} onPointerDown={onMiniDown} className="relative h-6 min-w-0 flex-1 cursor-pointer rounded bg-surface-2" role="slider" aria-label="Timeline overview. Drag to move the visible window." aria-valuenow={Math.round((view.left / Math.max(1, W - view.width)) * 100)} aria-valuemin={0} aria-valuemax={100} tabIndex={-1}>
          {placed.map((p) => (
            <span key={p.n.nodeId} className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(p.x / W) * 100}%`, background: nodeColor(p.n), marginTop: (p.li - (lanes.length - 1) / 2) * 4 }} />
          ))}
          <span className="absolute top-0 bottom-0 w-px bg-primary/60" style={{ left: `${(todayX / W) * 100}%` }} />
          <span
            className="absolute top-0 bottom-0 rounded border border-primary/50 bg-primary/10 transition-[left,width] duration-75"
            style={{ left: `${(view.left / W) * 100}%`, width: `${Math.min(100, (view.width / W) * 100)}%` }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip content="Zoom out (Ctrl + scroll)"><Button variant="ghost" size="icon-sm" onClick={() => zoomTo(z / 1.4)} disabled={z <= Z_MIN} aria-label="Zoom out"><LuZoomOut /></Button></Tooltip>
          <span className="tabular w-10 text-center text-[11.5px] text-ink-3">{Math.round(z * 100)}%</span>
          <Tooltip content="Zoom in (Ctrl + scroll)"><Button variant="ghost" size="icon-sm" onClick={() => zoomTo(z * 1.4)} disabled={z >= Z_MAX} aria-label="Zoom in"><LuZoomIn /></Button></Tooltip>
          <Tooltip content="Fit whole case"><Button variant="ghost" size="icon-sm" onClick={() => { setZ(1); requestAnimationFrame(() => scroller.current && (scroller.current.scrollLeft = 0)) }} aria-label="Fit whole case"><LuMaximize2 /></Button></Tooltip>
        </div>
      </div>
    </div>
  )
}
