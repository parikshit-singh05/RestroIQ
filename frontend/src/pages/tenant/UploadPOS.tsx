import React, { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Database,
  Sparkles,
  RefreshCw,
  Table,
  Check
} from 'lucide-react'

interface ColumnSuggestion {
  canonical_field: string
  matched_header: string | null
  confidence: number
  required: boolean
  description: string
}

export function UploadPOS() {
  const { currentRestaurant, branches, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const welcomeMessage = (location.state as any)?.welcome

  // State
  const [file, setFile] = useState<File | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0])
    }
  }

  const processSelectedFile = async (selectedFile: File) => {
    if (!currentRestaurant) {
      setError('Please select or create a restaurant workspace first.')
      return
    }

    setFile(selectedFile)
    setError(null)
    setIngestResult(null)
    setLoadingPreview(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await api.post(
        `/tenant/restaurants/${currentRestaurant.id}/uploads/preview`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${session?.access_token}`
          }
        }
      )

      const data = response.data
      setPreviewData(data)

      // Initialize mapping from auto suggestions
      const initialMap: Record<string, string> = {}
      if (data.suggested_mapping) {
        Object.entries(data.suggested_mapping).forEach(([canonical, matched]) => {
          if (matched) initialMap[canonical] = matched as string
        })
      }
      setMapping(initialMap)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to inspect file headers.')
      setFile(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleLoadSample = async () => {
    if (!currentRestaurant) return
    setError(null)
    setIngesting(true)

    try {
      const response = await api.post(
        `/tenant/restaurants/${currentRestaurant.id}/uploads/load-sample`,
        {},
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setIngestResult(response.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load sample dataset.')
    } finally {
      setIngesting(false)
    }
  }

  const handleCommitIngestion = async () => {
    if (!currentRestaurant || !file) return
    setError(null)
    setIngesting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mapping', JSON.stringify(mapping))
      if (selectedBranchId) {
        formData.append('branch_id', selectedBranchId)
      }

      const response = await api.post(
        `/tenant/restaurants/${currentRestaurant.id}/uploads/commit`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${session?.access_token}`
          }
        }
      )

      setIngestResult(response.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Data ingestion failed.')
    } finally {
      setIngesting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      {welcomeMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-emerald-400">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 shrink-0" />
            <span className="text-[13px] font-semibold">{welcomeMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Upload POS Sales Data
          </h1>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Ingest heterogeneous CSV or Excel order exports for automated demand intelligence.
          </p>
        </div>

        {/* Quick Sample Button */}
        <button
          onClick={handleLoadSample}
          disabled={ingesting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Load Spice Garden Sample POS</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-[13px]">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Ingestion Issue</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Ingestion Success Banner */}
      {ingestResult && (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-lg text-[var(--color-text)] space-y-4">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
            <h3 className="text-lg font-bold">POS Data Successfully Ingested!</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
              <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Line Items Inserted</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{ingestResult.inserted_rows?.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
              <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Duplicate Rows Skipped</div>
              <div className="text-xl font-bold text-[var(--color-text)] mt-1">{ingestResult.duplicate_rows?.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
              <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Operational Span</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{ingestResult.date_range?.days || '0'} Days</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
              <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Dishes Cataloged</div>
              <div className="text-xl font-bold text-[var(--color-text)] mt-1">{ingestResult.unique_items_added || '0'}</div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {ingestResult.message}
            </p>
            <button
              onClick={() => navigate('/app/overview')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <span>Explore Dashboard Velocity</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Drag & Drop Zone */}
      {!file && !ingestResult && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-500/10 scale-[1.005]'
              : 'border-[var(--color-border)] hover:border-emerald-500/50 bg-[var(--color-surface)]/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-4 shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-bold text-[var(--color-text)]">
            Drop your POS export file here, or click to browse
          </h3>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1.5 max-w-md mx-auto">
            Supports CSV and Excel (<span className="font-mono text-emerald-400">.xlsx</span>) formats up to 50MB. Auto-detects custom POS column naming conventions.
          </p>

          <div className="mt-6 flex items-center justify-center gap-6 text-[12px] text-[var(--color-text-tertiary)]">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>UTF-8 / Excel 2016+</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Idempotent Deduplication</span>
            </div>
          </div>
        </div>
      )}

      {loadingPreview && (
        <div className="py-12 flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
          <span className="text-[13px] font-semibold">Inspecting headers & matching canonical fields...</span>
        </div>
      )}

      {/* File Loaded & Mapping Stage */}
      {previewData && !ingestResult && (
        <div className="space-y-6">
          {/* File Meta Pill */}
          <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              <div>
                <span className="text-[14px] font-bold text-[var(--color-text)]">{previewData.file_name}</span>
                <span className="text-[12px] text-[var(--color-text-tertiary)] ml-2">
                  ({previewData.total_estimated_rows.toLocaleString()} estimated records &bull; {previewData.file_format.toUpperCase()})
                </span>
              </div>
            </div>

            <button
              onClick={() => { setFile(null); setPreviewData(null) }}
              className="text-[12px] font-semibold text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors"
            >
              Choose different file
            </button>
          </div>

          {/* Column Mapping Visualizer */}
          <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)]">Review Column Mappings</h3>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                  Confirm or adjust how your POS headers map to RestroIQ's canonical data model.
                </p>
              </div>

              {/* Target Branch Selection */}
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Assign to Branch:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text)] outline-none"
                >
                  <option value="">-- Select Target Outlet (Mandatory) --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.branch_name} ({b.branch_code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Branch Confirmation Safeguard */}
            {!mapping.branch_code && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-400 text-[12px] font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Explicit Branch Confirmation Required: This file lacks a branch column. You must explicitly select and confirm the target outlet above before importing. Silent assignment to any branch (including single-branch restaurants) is prohibited.</span>
              </div>
            )}

            {/* Grid of Canonical Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {previewData.column_suggestions.map((sug: ColumnSuggestion) => {
                const currentVal = mapping[sug.canonical_field] || ''
                const isMatched = !!currentVal

                return (
                  <div
                    key={sug.canonical_field}
                    className={`p-3.5 rounded-xl border transition-all ${
                      sug.required && !isMatched
                        ? 'border-red-500/50 bg-red-500/5'
                        : isMatched
                        ? 'border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]'
                        : 'border-[var(--color-border-subtle)]/50 bg-transparent opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-[var(--color-text)] capitalize">
                          {sug.canonical_field.replace('_', ' ')}
                        </span>
                        {sug.required && (
                          <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.2 rounded bg-red-500/20 text-red-400">
                            Required
                          </span>
                        )}
                      </div>

                      {isMatched && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          {Math.round(sug.confidence * 100)}% match
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--color-text-tertiary)] mb-2.5 truncate">
                      {sug.description}
                    </p>

                    <select
                      value={currentVal}
                      onChange={(e) => {
                        const newMap = { ...mapping }
                        if (e.target.value) {
                          newMap[sug.canonical_field] = e.target.value
                        } else {
                          delete newMap[sug.canonical_field]
                        }
                        setMapping(newMap)
                      }}
                      className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Do Not Map --</option>
                      {previewData.detected_headers.map((h: string) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>

            {/* Preview of First 5 Rows */}
            {previewData.preview_rows && previewData.preview_rows.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  <Table className="w-4 h-4 text-emerald-400" />
                  <span>Raw Data Preview (First 5 Rows)</span>
                </div>

                <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-xl">
                  <table className="w-full text-[12px] text-left">
                    <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] uppercase tracking-wider text-[10px]">
                      <tr>
                        {previewData.detected_headers.map((h: string) => (
                          <th key={h} className="px-3 py-2 font-bold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                      {previewData.preview_rows.slice(0, 5).map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-[var(--color-surface-alt)]/40 transition-colors">
                          {previewData.detected_headers.map((h: string) => (
                            <td key={h} className="px-3 py-2 whitespace-nowrap text-[var(--color-text-secondary)]">
                              {row[h] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ingest Action Bar */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <div className="text-[12px] text-[var(--color-text-tertiary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Rows with non-positive quantities are flagged as returns and safely skipped.</span>
              </div>

              <button
                onClick={handleCommitIngestion}
                disabled={
                  ingesting ||
                  !mapping.order_date ||
                  !mapping.item_name ||
                  !mapping.quantity ||
                  (!mapping.branch_code && !selectedBranchId)
                }
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                {ingesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Ingestion...</span>
                  </>
                ) : (
                  <>
                    <span>Validate & Ingest POS Data</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

