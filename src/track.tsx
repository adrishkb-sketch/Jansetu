import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { getDemandById } from './services/db'
import { MapPin, Calendar, Clock, CheckCircle, Info, ShieldAlert, Zap, Droplets, BookOpen, ArrowLeft } from 'lucide-react'

function TrackComplaint() {
  const [complaintId, setComplaintId] = useState<string | null>(null)
  const [complaint, setComplaint] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const id = searchParams.get('id')
    setComplaintId(id)

    if (id) {
      getDemandById(id).then(data => {
        if (data) {
          setComplaint(data)
        } else {
          setError('Complaint not found.')
        }
        setLoading(false)
      }).catch(() => {
        setError('Error fetching details.')
        setLoading(false)
      })
    } else {
      setError('No tracking ID provided in URL.')
      setLoading(false)
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return '#10b981' // Green
      case 'reviewed': return '#f59e0b' // Yellow
      case 'solved': return '#3b82f6' // Blue
      default: return '#6366f1' // Indigo (Pending)
    }
  }

  const getCategoryIcon = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'water': return <Droplets className="w-5 h-5 text-blue-400" />
      case 'power': return <Zap className="w-5 h-5 text-yellow-400" />
      case 'health': return <ShieldAlert className="w-5 h-5 text-red-400" />
      case 'education': return <BookOpen className="w-5 h-5 text-purple-400" />
      case 'roads': return <MapPin className="w-5 h-5 text-gray-400" />
      default: return <Info className="w-5 h-5 text-indigo-400" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg text-app-text flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Loading complaint details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-app-bg text-app-text flex items-center justify-center p-6">
        <div className="card glass-panel max-w-md w-full p-8 text-center border border-red-500/20">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Tracking Failed</h2>
          <p className="text-gray-400">{error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-6 w-full btn-primary px-6 py-3 rounded-lg"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="card glass-panel p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-white/5">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Complaint #{complaintId?.slice(-6).toUpperCase()}</h1>
              <p className="text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> 
                Submitted on {new Date(complaint.createdAt).toLocaleDateString()}
              </p>
            </div>
            
            <div 
              className="px-4 py-2 rounded-full font-medium flex items-center gap-2 shadow-lg"
              style={{ backgroundColor: `${getStatusColor(complaint.status)}20`, color: getStatusColor(complaint.status), border: `1px solid ${getStatusColor(complaint.status)}40` }}
            >
              {complaint.status === 'solved' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {complaint.status?.toUpperCase() || 'PENDING'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2 font-semibold">Category & Scope</h3>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    {getCategoryIcon(complaint.category)}
                  </div>
                  <div>
                    <p className="font-medium text-lg capitalize">{complaint.category}</p>
                    <p className="text-gray-400 text-sm capitalize">{complaint.scope} Level Issue</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-2 font-semibold">Location</h3>
                <div className="flex gap-2">
                  <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-gray-300">{complaint.address || "Location not provided"}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-3 font-semibold">Description</h3>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-gray-300 whitespace-pre-wrap min-h-[100px]">
                {complaint.items?.find((i:any) => i.type === 'text')?.content || "No text description provided."}
              </div>
            </div>
          </div>

          {/* Resolution / Progress Section */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-400" />
              Resolution Updates
            </h3>
            
            {complaint.status === 'pending' && (
              <p className="text-gray-400 p-4 bg-white/5 rounded-lg border border-white/5">
                Your complaint has been received and is awaiting review by constituency managers. Please check back later.
              </p>
            )}
            
            {complaint.status === 'reviewed' && (
              <p className="text-yellow-400 p-4 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
                This complaint is currently under review by authorities. Necessary action plan is being determined.
              </p>
            )}
            
            {complaint.status === 'approved' && (
              <p className="text-green-400 p-4 bg-green-400/10 rounded-lg border border-green-400/20">
                Action has been approved. Funds or resources are being allocated to resolve this issue shortly.
              </p>
            )}
            
            {complaint.status === 'solved' && (
              <p className="text-blue-400 p-4 bg-blue-400/10 rounded-lg border border-blue-400/20">
                This issue has been successfully resolved! Thank you for helping improve your constituency.
              </p>
            )}
            
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackComplaint />
  </StrictMode>,
)
