'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { api, type Stem, type FilterOptions } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

const LIMIT = 50

const TC: Record<string, string> = { Acapella: 'sl-a', Drums: 'sl-d', Bass: 'sl-b', Melody: 'sl-m', Instrumental: 'sl-i' }
const TL: Record<string, string> = { Acapella: 'A', Drums: 'D', Bass: 'B', Melody: 'M', Instrumental: 'I' }

function fmtDur(s: number | null): string {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const NB = 200

function genWave(seed: number): number[] {
  let r = seed || 1
  function rng() { r = (r * 1664525 + 1013904223) >>> 0; return r / 0xffffffff }
  const out: number[] = []
  for (let i = 0; i < NB; i++) {
    let v = rng() * 0.6 + rng() * 0.25 + rng() * 0.15
    const edge = Math.min(1, Math.min(i, NB - 1 - i) / 12)
    if (rng() < 0.08) v *= 0.05 + rng() * 0.08
    else v = 0.15 + v * 0.75
    v *= edge
    out.push(Math.max(0.03, Math.min(0.97, v)))
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < out.length - 1; i++) {
      out[i] = out[i] * 0.5 + (out[i - 1] + out[i + 1]) * 0.25
    }
  }
  return out
}

export function LibraryClient() {
  const { me } = useAuth()
  const hasFullAccess = me?.tier === 'paid' || me?.tier === 'admin'

  const [stems, setStems] = useState<Stem[]>([])
  // For paid/admin users override isLocked — server still enforces on download
  const visibleStems = hasFullAccess ? stems.map(s => ({ ...s, isLocked: false })) : stems
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
  const [filters, setFilters] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [stemType, setStemType] = useState('All')
  const [genre, setGenre] = useState('')
  const [key, setKey] = useState('')
  const [bpmRange, setBpmRange] = useState('')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)

  // Player state
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const waveDataRef = useRef<number[]>(genWave(42))
  const [playing, setPlaying] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [currentStem, setCurrentStem] = useState<Stem | null>(null)
  const [curTime, setCurTime] = useState('0:00')
  const [totalTime, setTotalTime] = useState('0:00')
  const [vol, setVol] = useState(80)
  const [repeatMode, setRepeatMode] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  // Toast
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null)
  const showToast = (msg: string, err = false) => {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    api.stems.filterOptions().then(setFilters).catch(() => { })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: String(LIMIT), sort }
    if (search) params.search = search
    if (stemType !== 'All') params.stem_type = stemType
    if (genre) params.genre = genre
    if (key) params.key = key
    if (bpmRange) {
      const [min, max] = bpmRange.split('-')
      params.bpm_min = min
      params.bpm_max = max
    }
    const data = await api.stems.list(params)
    setStems(data.stems)
    setPagination(data.pagination)
    setLoading(false)
  }, [page, sort, search, stemType, genre, key, bpmRange])

  useEffect(() => { load() }, [load])

  // Waveform draw
  function drawWave(pct: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.width / dpr, H = canvas.height / dpr
    ctx.clearRect(0, 0, W, H)
    const data = waveDataRef.current
    const bW = W / data.length
    const gap = Math.max(1, Math.round(bW * 0.22))
    const bw = Math.max(1, bW - gap)
    const mid = H / 2, px = pct * W
    const aC = 'rgba(96,116,255,1)', aF = 'rgba(96,116,255,.2)'
    const uC = 'rgba(255,255,255,.22)', uF = 'rgba(255,255,255,.03)'
    data.forEach((v, i) => {
      const x = i * bW
      const played = x + bw < px
      const bH = Math.max(2, v * mid * 0.82)
      const gT = ctx.createLinearGradient(0, mid - bH, 0, mid)
      gT.addColorStop(0, played ? aC : uC)
      gT.addColorStop(1, played ? aF : uF)
      ctx.fillStyle = gT
      ctx.beginPath()
      try { if (ctx.roundRect) ctx.roundRect(x, mid - bH, bw, bH, [1, 1, 0, 0] as unknown as number); else ctx.rect(x, mid - bH, bw, bH) }
      catch { ctx.rect(x, mid - bH, bw, bH) }
      ctx.fill()
      const rH = bH * 0.28
      const gB = ctx.createLinearGradient(0, mid, 0, mid + rH)
      gB.addColorStop(0, played ? aF : uF)
      gB.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gB
      ctx.beginPath()
      ctx.rect(x, mid, bw, rH)
      ctx.fill()
    })
  }

  function resizeCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (!rect.width) return
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round((rect.height || 38) * dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
    drawWave(audioRef.current ? audioRef.current.currentTime / (audioRef.current.duration || 1) : 0)
  }

  useEffect(() => {
    setTimeout(resizeCanvas, 150)
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  function startRAF() {
    function loop() {
      const audio = audioRef.current
      if (!audio || audio.paused) return
      const pct = audio.currentTime / (audio.duration || 1)
      drawWave(pct)
      const m = Math.floor(audio.currentTime / 60)
      const s = Math.floor(audio.currentTime % 60)
      setCurTime(`${m}:${String(s).padStart(2, '0')}`)
      rafRef.current = requestAnimationFrame(loop)
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }

  async function togglePlay(stem: Stem) {
    if (stem.isLocked) return
    const id = stem.id as unknown as number

    if (currentId === id) {
      const audio = audioRef.current
      if (!audio) return
      if (audio.paused) { audio.play(); setPlaying(true); startRAF() }
      else { audio.pause(); setPlaying(false); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
      return
    }

    // Stop current
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPlaying(false)

    try {
      let url = previewUrls[stem.id]
      if (!url) {
        const r = await api.stems.preview(stem.id)
        url = r.url
        setPreviewUrls(p => ({ ...p, [stem.id]: url }))
      }
      waveDataRef.current = genWave((id as unknown as number) * 137)
      resizeCanvas()
      drawWave(0)

      const audio = new Audio(url)
      audio.volume = vol / 100
      audioRef.current = audio
      setCurrentId(id)
      setCurrentStem(stem)

      if (stem.duration) {
        const m = Math.floor(stem.duration / 60)
        setTotalTime(`${m}:${String(Math.floor(stem.duration % 60)).padStart(2, '0')}`)
      }

      audio.onended = () => {
        setPlaying(false)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        drawWave(1)
        if (repeatMode) { audio.currentTime = 0; audio.play(); setPlaying(true); startRAF() }
      }

      await audio.play()
      setPlaying(true)
      startRAF()
    } catch { showToast('Error playing preview', true) }
  }

  async function downloadStem(stem: Stem) {
    try {
      const { url } = await api.stems.download(stem.id)
      window.open(url, '_blank')
      showToast('✅ Download started!')
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('locked')) showToast('Upgrade to access this stem', true)
      else showToast('Download failed', true)
    }
  }

  function changePage(p: number) {
    if (p < 1 || p > pagination.pages) return
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function seekWave(e: React.MouseEvent<HTMLCanvasElement>) {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * audio.duration
    drawWave(pct)
  }

  const hasFilters = !!(bpmRange || key || genre)

  return (
    <>
      <style>{`
        .lw{max-width:1160px;margin:0 auto;padding:20px 24px calc(var(--ph,72px) + 24px);}
        .lib-topbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:nowrap;}
        .lib-search{flex:1;min-width:160px;height:38px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:0 12px 0 34px;color:var(--tx);font-size:13px;outline:none;font-family:'Poppins',sans-serif;background-image:url('data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%2214%22 height%3D%2214%22 fill%3D%22none%22 viewBox%3D%220 0 24 24%22 stroke%3D%22%235a6488%22 stroke-width%3D%222%22%3E%3Ccircle cx%3D%2211%22 cy%3D%2211%22 r%3D%228%22%2F%3E%3Cpath d%3D%22m21 21-4.35-4.35%22%2F%3E%3C%2Fsvg%3E');background-repeat:no-repeat;background-position:11px center;transition:.15s;}
        .lib-search:focus{border-color:rgba(96,116,255,.35);}
        .lib-search::placeholder{color:var(--mu2);opacity:1;}
        .lib-sort{height:38px;padding:0 9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;color:var(--mu2);font-size:11px;outline:none;cursor:pointer;font-family:'Exo 2',sans-serif;letter-spacing:.03em;flex-shrink:0;transition:.15s;}
        .lib-sort:hover{border-color:rgba(255,255,255,.16);color:var(--mu);}
        .lib-sort option{background:#000510;color:#c0c8e0;}
        .fa-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;height:34px;padding:0 13px;border-radius:6px;background:linear-gradient(135deg,#0a0e22,#12173a);border:1px solid rgba(96,116,255,.42);color:#a0b0ff;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .25s;font-family:'Exo 2',sans-serif;letter-spacing:.05em;flex-shrink:0;box-shadow:0 0 10px rgba(96,116,255,.12);}
        .fa-btn:hover{border-color:rgba(96,116,255,.7);color:#c4d0ff;}
        #row2{display:flex;align-items:center;gap:8px;margin-bottom:10px;width:100%;}
        .cat-row{display:flex;align-items:center;flex-wrap:nowrap;gap:5px;flex-shrink:0;}
        .cat-pill{height:32px;padding:0 14px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid var(--di);color:var(--mu);font-size:11px;font-family:'Exo 2',sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;font-weight:500;transition:all .18s;white-space:nowrap;}
        .cat-pill-all:hover,.cat-pill-all.active{background:rgba(255,255,255,.1)!important;border-color:rgba(255,255,255,.3)!important;color:#fff!important;font-weight:600!important;}
        .cat-pill-a:hover,.cat-pill-a.active{background:rgba(210,40,40,.12)!important;border-color:#d82828!important;color:#ff5555!important;}
        .cat-pill-d:hover,.cat-pill-d.active{background:rgba(96,116,255,.14)!important;border-color:var(--acc)!important;color:#8097ff!important;}
        .cat-pill-b:hover,.cat-pill-b.active{background:rgba(30,185,145,.12)!important;border-color:#1eb991!important;color:#23c99a!important;}
        .cat-pill-m:hover,.cat-pill-m.active{background:rgba(215,170,28,.12)!important;border-color:#d0a81c!important;color:#ddb820!important;}
        .cat-pill-i:hover,.cat-pill-i.active{background:rgba(160,85,235,.12)!important;border-color:#9050e0!important;color:#b070f0!important;}
        .cp-abbr{display:none;}
        .filter-strip{display:flex;align-items:center;gap:5px;flex:1;min-width:0;justify-content:flex-end;}
        .fs-select{height:34px;padding:0 24px 0 9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;color:var(--mu2);font-family:'Exo 2',sans-serif;font-size:11px;outline:none;cursor:pointer;transition:all .15s;flex-shrink:0;-webkit-appearance:none;appearance:none;background-image:url('data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%2210%22 height%3D%2210%22 viewBox%3D%220 0 24 24%22 fill%3D%22none%22 stroke%3D%22%235a6488%22 stroke-width%3D%222%22%3E%3Cpolyline points%3D%226 9 12 15 18 9%22%2F%3E%3C%2Fsvg%3E');background-repeat:no-repeat;background-position:right 7px center;min-width:70px;}
        .fs-select:hover{border-color:rgba(255,255,255,.16);color:var(--mu);}
        .fs-select.on{background-color:rgba(96,116,255,.1);border-color:rgba(96,116,255,.38);color:var(--acc);}
        .fs-select option{background:#000510;color:#c0c8e0;}
        .pagination{display:flex;align-items:center;justify-content:center;gap:5px;padding:14px 0 6px;flex-wrap:wrap;}
        .pag-num,.pag-arr{width:32px;height:32px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid var(--di);color:var(--mu);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;}
        .pag-num:hover{background:rgba(255,255,255,.08);}
        .pag-num.active{background:rgba(96,116,255,.2);border-color:var(--acc);color:var(--acc);font-weight:600;}
        .pag-arr:disabled{opacity:.3;cursor:default;}
        .lib-table-wrap{width:100%;background:linear-gradient(180deg,var(--pb),var(--pb2));border:1px solid var(--di);border-radius:12px;overflow:hidden;}
        .lib-table-scroll{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .lib-table{width:100%;border-collapse:collapse;min-width:560px;}
        .lib-table thead th{padding:10px 18px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);white-space:nowrap;border-bottom:1px solid var(--di);font-family:'Exo 2',sans-serif;}
        .lib-table thead th:first-child{padding-left:10px!important;}
        .lib-table thead th:last-child{text-align:right;padding-right:16px!important;}
        .lib-table tbody tr{border-bottom:1px solid rgba(255,255,255,.032);transition:background .12s;}
        .lib-table tbody tr:last-child{border-bottom:none;}
        .lib-table tbody tr:hover{background:rgba(255,255,255,.024);}
        .lib-table tbody tr.is-locked{opacity:.78;}
        .lib-table td{padding:13px 18px;font-size:13px;color:var(--tx);vertical-align:middle;white-space:nowrap;}
        .lib-table td:first-child{padding-left:10px;padding-right:6px;}
        .lib-table td:last-child{text-align:right;padding-right:16px;}
        .play-art{position:relative;width:40px;height:40px;display:inline-flex;flex-shrink:0;cursor:pointer;}
        .play-art-bg{width:40px;height:40px;border-radius:7px;overflow:hidden;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;}
        .play-art-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.42);border-radius:7px;transition:background .15s;opacity:0;}
        .play-art:hover .play-art-ov{opacity:1;}
        .play-art-ov.playing{opacity:1;background:rgba(0,0,0,.52);}
        .trk-title{font-weight:500;font-size:13px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px;line-height:1.25;}
        .trk-artist{font-size:11px;color:var(--mu);opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px;margin-top:2px;}
        .stem-ltr{font-family:'Exo 2',sans-serif;font-size:13px;font-weight:700;display:inline-block;}
        .sl-a{color:#f07070;}.sl-d{color:#7090e8;}.sl-b{color:#40c990;}.sl-m{color:#d8b020;}.sl-i{color:#b070e8;}
        .info-btn{background:none;border:none;color:var(--mu);font-size:16px;font-style:italic;font-family:'Georgia',serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:color .15s;width:22px;height:30px;padding:0;font-weight:600;line-height:1;}
        .info-btn:hover{color:var(--acc);}
        .download-glass{cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--mu);transition:.2s;}
        .download-glass:hover{background:rgba(96,116,255,.16);border-color:rgba(96,116,255,.45);color:#fff;}
        .unlock-row-btn{position:relative;overflow:hidden;height:26px;padding:0 11px;border-radius:6px;background:linear-gradient(135deg,#0a0e22,#12173a);border:1px solid rgba(96,116,255,.5);color:#a0b0ff;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .25s;display:inline-flex;align-items:center;gap:4px;box-shadow:0 0 10px rgba(96,116,255,.18);font-family:'Exo 2',sans-serif;letter-spacing:.04em;}
        .lib-card-list{background:linear-gradient(180deg,var(--pb),var(--pb2));border:1px solid var(--di);border-radius:12px;overflow:hidden;display:none;}
        .stem-card{display:flex;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid var(--di);transition:background .12s;}
        .stem-card:last-child{border-bottom:none;}
        .stem-card:hover{background:rgba(255,255,255,.02);}
        .sc-info{flex:1;min-width:0;}
        .sc-title{font-size:13px;font-weight:500;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;margin-bottom:2px;}
        .sc-artist{font-size:11px;color:var(--mu2);opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;}
        .sc-chips{display:flex;align-items:center;gap:6px;}
        .sc-dur{font-family:'Exo 2',sans-serif;font-size:10px;color:var(--mu2);letter-spacing:.02em;}
        .sc-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
        .player-bar{position:fixed;bottom:0;left:0;right:0;height:var(--ph,72px);background:rgba(4,8,22,.96);border-top:1px solid rgba(255,255,255,.07);backdrop-filter:blur(20px);display:grid;grid-template-columns:170px 1fr auto;align-items:center;padding:0 32px;z-index:60;gap:16px;}
        .p-left{display:flex;align-items:center;gap:10px;min-width:0;}
        .p-art{width:42px;height:42px;border-radius:7px;flex-shrink:0;background:rgba(255,255,255,.07);border:1px solid var(--di);display:flex;align-items:center;justify-content:center;font-size:16px;overflow:hidden;position:relative;}
        .p-title{font-size:12px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;}
        .p-artist{font-size:10px;color:var(--mu);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;}
        .p-center{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;}
        .p-controls{display:flex;align-items:center;justify-content:center;gap:14px;width:100%;}
        .pc-btn{background:none;border:none;color:var(--mu);cursor:pointer;display:flex;align-items:center;transition:color .15s;}
        .pc-btn:hover{color:var(--tx);}
        .pc-repeat.on{color:var(--acc);}
        .play-ring-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;}
        .play-ring{position:absolute;width:42px;height:42px;pointer-events:none;top:-5px;left:-5px;}
        .ring-track{fill:none;stroke:rgba(143,154,191,.15);stroke-width:1.5;}
        .ring-prog{fill:none;stroke:var(--acc);stroke-width:1.8;stroke-linecap:round;stroke-dasharray:101;stroke-dashoffset:101;transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset .3s linear;}
        .pc-play{width:32px;height:32px;border-radius:50%;background:rgba(200,208,228,.18);border:1px solid rgba(200,208,228,.28);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s;flex-shrink:0;}
        .pc-play:hover{transform:scale(1.07);}
        .p-wave-row{display:flex;align-items:center;gap:9px;width:100%;}
        .p-time{font-family:'Exo 2',sans-serif;font-size:10px;color:var(--mu2);min-width:32px;text-align:center;flex-shrink:0;}
        .p-right-wrap{display:flex;align-items:center;justify-content:flex-end;}
        .vol-wrap{display:flex;align-items:center;gap:6px;}
        .vol-slider{-webkit-appearance:none;appearance:none;width:76px;height:4px;border-radius:3px;outline:none;cursor:pointer;background:linear-gradient(to right,var(--acc) 80%,rgba(255,255,255,.12) 80%);}
        .vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 0 0 2px rgba(104,120,255,.55),0 2px 6px rgba(0,0,0,.4);}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:768px){
          :root{--ph:100px;}
          .lw{padding:10px 10px calc(var(--ph,100px)+16px)!important;}
          #desktopTable{display:none!important;}
          .lib-card-list{display:block!important;}
          .cat-pill{flex-shrink:0!important;width:32px!important;height:32px!important;font-size:12px!important;letter-spacing:0!important;padding:0!important;}
          .all-pill-mob{width:34px!important;}
          .cp-full{display:none!important;}
          .cp-abbr{display:inline!important;}
          .filter-strip{display:none!important;}
          #mobFilterRow{display:flex!important;}
          .player-bar{grid-template-columns:1fr!important;padding:8px 16px 10px!important;height:auto!important;}
          .p-left{display:none!important;}
          .p-right-wrap{display:none!important;}
        }
        @media(min-width:769px){
          #desktopTable{display:block!important;}
          .lib-card-list{display:none!important;}
          #mobFilterRow{display:none!important;}
          .mob-unlock-wrap{display:none!important;}
          .cp-full{display:inline!important;}
          .cp-abbr{display:none!important;}
        }
      `}</style>

      <div className="lw">
        {/* Access strip — hidden for paid users */}
        {!hasFullAccess && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(96,116,255,.055)', border: '1px solid rgba(96,116,255,.13)', borderRadius: 7, padding: '7px 14px', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--mu)', flex: 1 }}>
              <strong style={{ color: 'var(--tx)' }}>Free Access</strong> — Browse and preview stems. Get{' '}
              <Link href="/pricing" style={{ color: 'var(--acc)', fontWeight: 600 }}>Full Access</Link>
              {' '}to unlock everything.
            </span>
          </div>
        )}

        {/* Top bar */}
        <div className="lib-topbar">
          <input className="lib-search" type="search" placeholder="Search stems, artists, genres…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <select className="lib-sort" value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}>
            <option value="recent">Most Recent</option>
            <option value="genre">Sort by Genre</option>
            <option value="key">Sort by Key</option>
            <option value="bpmAsc">BPM: Low to High</option>
            <option value="bpmDesc">BPM: High to Low</option>
            <option value="title">Title A to Z</option>
          </select>
          <Link href="/pricing" className="fa-btn" style={{ display: 'inline-flex' }}><span>Unlock Full Access</span></Link>
        </div>

        {/* Row 2: pills + filter strip */}
        <div id="row2">
          <div className="cat-row">
            {[
              { cat: 'All', cls: 'cat-pill-all', full: 'All', abbr: '★' },
              { cat: 'Acapella', cls: 'cat-pill-a', full: 'Acapella', abbr: 'A' },
              { cat: 'Drums', cls: 'cat-pill-d', full: 'Drums', abbr: 'D' },
              { cat: 'Bass', cls: 'cat-pill-b', full: 'Bass', abbr: 'B' },
              { cat: 'Melody', cls: 'cat-pill-m', full: 'Melody', abbr: 'M' },
              { cat: 'Instrumental', cls: 'cat-pill-i', full: 'Instrumental', abbr: 'I' },
            ].map(p => (
              <button
                key={p.cat}
                className={`cat-pill ${p.cls}${stemType === p.cat ? ' active' : ''}`}
                onClick={() => { setStemType(p.cat); setPage(1) }}
              >
                <span className="cp-full">{p.full}</span>
                <span className="cp-abbr">{p.abbr}</span>
              </button>
            ))}
          </div>

          <div className="filter-strip">
            <select className={`fs-select${bpmRange ? ' on' : ''}`} value={bpmRange} onChange={e => { setBpmRange(e.target.value); setPage(1) }}>
              <option value="">BPM</option>
              <option value="0-69">Under 70</option>
              <option value="70-79">70 – 79</option>
              <option value="80-89">80 – 89</option>
              <option value="90-99">90 – 99</option>
              <option value="100-109">100 – 109</option>
              <option value="110-119">110 – 119</option>
              <option value="120-999">120+</option>
            </select>
            <select className={`fs-select${key ? ' on' : ''}`} value={key} onChange={e => { setKey(e.target.value); setPage(1) }}>
              <option value="">Key</option>
              {filters?.keys.map(k => <option key={k!} value={k!}>{k}</option>)}
            </select>
            <select className={`fs-select${genre ? ' on' : ''}`} value={genre} onChange={e => { setGenre(e.target.value); setPage(1) }}>
              <option value="">Genre</option>
              {filters?.genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {hasFilters && (
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', color: 'var(--mu2)', fontSize: 11, cursor: 'pointer' }}
                onClick={() => { setBpmRange(''); setKey(''); setGenre(''); setPage(1) }}>×</button>
            )}
          </div>
        </div>

        {/* Mobile filters */}
        <div id="mobFilterRow" style={{ gap: 6, marginBottom: 10, display: 'none' }}>
          <select className="mob-fs" style={{ flex: 1, minWidth: 0, height: 32, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--mu2)', fontFamily: "'Exo 2',sans-serif", fontSize: 11, outline: 'none', cursor: 'pointer', padding: '0 8px' }}
            value={bpmRange} onChange={e => { setBpmRange(e.target.value); setPage(1) }}>
            <option value="">BPM</option>
            <option value="0-69">Under 70</option>
            <option value="70-79">70–79</option>
            <option value="80-89">80–89</option>
            <option value="90-99">90–99</option>
            <option value="100-109">100–109</option>
            <option value="110-119">110–119</option>
            <option value="120-999">120+</option>
          </select>
          <select style={{ flex: 1, minWidth: 0, height: 32, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--mu2)', fontFamily: "'Exo 2',sans-serif", fontSize: 11, outline: 'none', cursor: 'pointer', padding: '0 8px' }}
            value={key} onChange={e => { setKey(e.target.value); setPage(1) }}>
            <option value="">Key</option>
            {filters?.keys.map(k => <option key={k!}>{k}</option>)}
          </select>
          <select style={{ flex: 1, minWidth: 0, height: 32, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: 'var(--mu2)', fontFamily: "'Exo 2',sans-serif", fontSize: 11, outline: 'none', cursor: 'pointer', padding: '0 8px' }}
            value={genre} onChange={e => { setGenre(e.target.value); setPage(1) }}>
            <option value="">Genre</option>
            {filters?.genres.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        {/* Pagination top */}
        <Pagination page={page} pages={pagination.pages} total={pagination.total} onChange={changePage} />

        {/* Desktop table */}
        <div className="lib-table-wrap" id="desktopTable">
          <div className="lib-table-scroll">
            <table className="lib-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}></th>
                  <th style={{ minWidth: 190 }}>Title</th>
                  <th style={{ width: 66, textAlign: 'center' }}>Time</th>
                  <th style={{ width: 52, textAlign: 'center' }}>Type</th>
                  <th style={{ width: 70, textAlign: 'center' }}>BPM</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Key</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Genre</th>
                  <th style={{ width: 28 }}></th>
                  <th style={{ width: 44, textAlign: 'right', paddingRight: 16 }}>DL</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--mu)' }}>Loading stems…</td></tr>
                )}
                {!loading && visibleStems.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--mu)' }}>No stems found</td></tr>
                )}
                {visibleStems.map(s => {
                  const isPlaying = currentId === (s.id as unknown as number) && playing
                  const genres = (s as unknown as { genres?: { name: string }[] }).genres
                  const genreStr = genres?.map((g: { name: string }) => g.name).join(', ') ?? ''
                  return (
                    <tr key={s.id} className={s.isLocked ? 'is-locked' : ''}>
                      <td style={{ padding: '11px 6px 11px 10px' }}>
                        {s.isLocked
                          ? <div className="play-art"><div className="play-art-bg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div><div className="play-art-ov" style={{ opacity: 1, cursor: 'default' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></div></div>
                          : <div className="play-art" onClick={() => togglePlay(s)} style={{ cursor: 'pointer' }}>
                            <div className="play-art-bg">
                              {s.coverArtUrl
                                ? <img src={s.coverArtUrl} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>}
                            </div>
                            <div className={`play-art-ov${isPlaying ? ' playing' : ''}`}>
                              {isPlaying
                                ? <svg width="10" height="10" viewBox="0 0 16 16" fill="#fff"><rect x="3" y="2" width="3" height="12" rx="1" /><rect x="10" y="2" width="3" height="12" rx="1" /></svg>
                                : <svg width="10" height="10" viewBox="0 0 16 16" fill="#fff" style={{ marginLeft: 1 }}><path d="M4 2.5 13.5 8 4 13.5z" /></svg>}
                            </div>
                          </div>}
                      </td>
                      <td><div className="trk-title">{s.title}</div><div className="trk-artist">{s.artist}</div></td>
                      <td style={{ textAlign: 'center', fontFamily: "'Exo 2',sans-serif", fontSize: 12, color: 'var(--mu2)' }}>{s.isLocked ? '—' : fmtDur(s.duration)}</td>
                      <td style={{ textAlign: 'center' }}><span className={`stem-ltr ${TC[s.stemType] ?? 'sl-a'}`}>{TL[s.stemType] ?? s.stemType?.[0]}</span></td>
                      <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--mu)', fontVariantNumeric: 'tabular-nums' }}>{s.isLocked ? '—' : (s.bpm ? Number(s.bpm).toFixed(1) : '—')}</td>
                      <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--mu)' }}>{s.isLocked ? '—' : (s.musicalKey?.replace(/#/g, '♯') ?? '—')}</td>
                      <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--mu)' }}>{s.isLocked ? '—' : genreStr}</td>
                      <td></td>
                      <td style={{ textAlign: 'right', paddingRight: 16 }}>
                        {s.isLocked
                          ? <button className="unlock-row-btn" onClick={() => window.location.href = '/pricing'}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
                            <span>Unlock</span>
                          </button>
                          : <button className="download-glass" onClick={() => downloadStem(s)} title="Download">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          </button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile card list */}
        <div className="lib-card-list">
          {visibleStems.map(s => {
            const isPlaying = currentId === (s.id as unknown as number) && playing
            return (
              <div key={s.id} className={`stem-card${s.isLocked ? ' is-locked' : ''}`}>
                <div className="play-art" style={{ width: 40, height: 40 }} onClick={() => !s.isLocked && togglePlay(s)}>
                  <div className="play-art-bg" style={{ width: 40, height: 40 }}>
                    {s.coverArtUrl
                      ? <img src={s.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>}
                  </div>
                  <div className={`play-art-ov${isPlaying ? ' playing' : ''}`}>
                    {isPlaying
                      ? <svg width="10" height="10" viewBox="0 0 16 16" fill="#fff"><rect x="3" y="2" width="3" height="12" rx="1" /><rect x="10" y="2" width="3" height="12" rx="1" /></svg>
                      : <svg width="10" height="10" viewBox="0 0 16 16" fill="#fff" style={{ marginLeft: 1 }}><path d="M4 2.5 13.5 8 4 13.5z" /></svg>}
                  </div>
                </div>
                <div className="sc-info">
                  <div className="sc-title">{s.title}</div>
                  <div className="sc-artist">{s.artist}</div>
                  <div className="sc-chips">
                    <span className={`stem-ltr ${TC[s.stemType] ?? 'sl-a'}`} style={{ fontSize: 12 }}>{TL[s.stemType] ?? s.stemType?.[0]}</span>
                    {!s.isLocked && <span className="sc-dur">{fmtDur(s.duration)}</span>}
                  </div>
                </div>
                <div className="sc-actions">
                  {s.isLocked
                    ? <button className="unlock-row-btn" onClick={() => window.location.href = '/pricing'}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
                      <span>Unlock</span>
                    </button>
                    : <button className="download-glass" onClick={() => downloadStem(s)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    </button>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination bottom */}
        <Pagination page={page} pages={pagination.pages} total={pagination.total} onChange={changePage} />
      </div>

      {/* Player bar */}
      <div className="player-bar">
        <div className="p-left">
          <div className="p-art">
            {currentStem?.coverArtUrl
              ? <img src={currentStem.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>}
          </div>
          <div>
            <div className="p-title">{currentStem?.title ?? 'No track selected'}</div>
            <div className="p-artist">{currentStem?.artist ?? '—'}</div>
          </div>
        </div>

        <div className="p-center">
          <div className="p-controls">
            <button className="pc-btn" onClick={() => {
              const idx = visibleStems.findIndex(s => (s.id as unknown as number) === currentId)
              if (idx > 0 && !visibleStems[idx - 1].isLocked) togglePlay(visibleStems[idx - 1])
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
            </button>
            <div className="play-ring-wrap">
              <svg className="play-ring" viewBox="0 0 42 42">
                <circle className="ring-track" cx="21" cy="21" r="16" />
                <circle className="ring-prog" cx="21" cy="21" r="16"
                  style={{ strokeDashoffset: audioRef.current ? 101 * (1 - audioRef.current.currentTime / (audioRef.current.duration || 1)) : 101 }} />
              </svg>
              <button className="pc-play" onClick={() => {
                if (currentStem) togglePlay(currentStem)
              }}>
                {playing
                  ? <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="rgba(4,8,22,.82)" /></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" style={{ marginLeft: 1 }}><path d="M8 5v14l11-7z" fill="rgba(4,8,22,.82)" /></svg>}
              </button>
            </div>
            <button className="pc-btn" onClick={() => {
              const idx = visibleStems.findIndex(s => (s.id as unknown as number) === currentId)
              if (idx !== -1 && idx < visibleStems.length - 1 && !visibleStems[idx + 1].isLocked) togglePlay(visibleStems[idx + 1])
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
            <button className={`pc-btn pc-repeat${repeatMode ? ' on' : ''}`} onClick={() => setRepeatMode(r => !r)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            </button>
          </div>
          <div className="p-wave-row">
            <span className="p-time">{curTime}</span>
            <canvas ref={canvasRef} id="waveformCanvas" onClick={seekWave}
              style={{ flex: 1, height: 38, cursor: 'pointer', display: 'block', borderRadius: 3, minWidth: 0 }} />
            <span className="p-time">{totalTime}</span>
          </div>
        </div>

        <div className="p-right-wrap">
          <div className="vol-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mu2)" strokeWidth="1.8">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            <input type="range" className="vol-slider" min={0} max={100} value={vol}
              onChange={e => {
                const v = Number(e.target.value)
                setVol(v)
                if (audioRef.current) audioRef.current.volume = v / 100
              }} />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 'calc(var(--ph,72px) + 14px)', left: '50%', transform: 'translateX(-50%)',
          color: '#fff', padding: '10px 20px', borderRadius: 8, zIndex: 400, fontSize: 13,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          background: toast.err ? '#ef4444' : '#22c55e',
        }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}

function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  const nums: number[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) nums.push(i)
  }
  return (
    <div className="pagination">
      <button className="pag-arr" disabled={page === 1} onClick={() => onChange(page - 1)}>←</button>
      {nums.map((n, idx) => {
        const prev = nums[idx - 1]
        return (
          <>
            {prev && n - prev > 1 && <span key={`e${n}`} style={{ padding: '0 4px', opacity: 0.3 }}>…</span>}
            <button key={n} className={`pag-num${n === page ? ' active' : ''}`} onClick={() => onChange(n)}>{n}</button>
          </>
        )
      })}
      <button className="pag-arr" disabled={page === pages} onClick={() => onChange(page + 1)}>→</button>
    </div>
  )
}
