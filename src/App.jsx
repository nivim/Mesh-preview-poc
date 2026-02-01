import React, { useState, useCallback } from 'react'
import IFCViewer from './components/IFCViewer'

function App() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Initializing...')

  const handleStatsUpdate = useCallback((newStats) => {
    setStats(newStats)
  }, [])

  const handleLoadingChange = useCallback((isLoading, message) => {
    setLoading(isLoading)
    if (message) setLoadingMessage(message)
  }, [])

  return (
    <div className="app-container">
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div>{loadingMessage}</div>
        </div>
      )}

      <div className="info-panel">
        <h2>IFC Mesh Preview POC</h2>
        {stats && stats.demoMode && (
          <div className="stat" style={{background: '#2e7d32', padding: '5px', borderRadius: '4px', marginBottom: '10px'}}>
            <span className="label" style={{color: '#fff'}}>Demo Mode: </span>
            <span style={{color: '#c8e6c9'}}>Model raised to show base fill</span>
          </div>
        )}
        {stats && (
          <>
            <div className="stat">
              <span className="label">Original Bounding Box: </span>
              <span className="value">
                {stats.originalBBox.x.toFixed(2)} x {stats.originalBBox.y.toFixed(2)} x {stats.originalBBox.z.toFixed(2)} m
              </span>
            </div>
            <div className="stat">
              <span className="label">Min Z (Ground Gap): </span>
              <span className="value">{stats.minZ.toFixed(3)} m</span>
            </div>
            <div className="stat">
              <span className="label">Original Volume: </span>
              <span className="value">{stats.originalVolume.toFixed(2)} m³</span>
            </div>
            <div className="stat">
              <span className="label">Base Fill Volume: </span>
              <span className="value success">+{stats.baseFillVolume.toFixed(2)} m³</span>
            </div>
            <div className="stat">
              <span className="label">Total with Fill: </span>
              <span className="value success">{stats.totalVolume.toFixed(2)} m³</span>
            </div>
            <div className="stat">
              <span className="label">Volume Increase: </span>
              <span className={stats.volumeIncrease > 0 ? "value success" : "value warning"}>
                {stats.volumeIncrease > 0 ? '+' : ''}{stats.volumeIncrease.toFixed(1)}%
              </span>
            </div>
            <hr style={{margin: '10px 0', borderColor: '#444'}} />
            <div className="stat">
              <span className="label">Vertices: </span>
              <span className="value">{stats.vertexCount.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Triangles: </span>
              <span className="value">{stats.triangleCount.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      <IFCViewer
        onStatsUpdate={handleStatsUpdate}
        onLoadingChange={handleLoadingChange}
      />
    </div>
  )
}

export default App
