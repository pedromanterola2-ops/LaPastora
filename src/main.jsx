import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/** ErrorBoundary: muestra el error en pantalla en vez de página en blanco */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem',
          fontFamily: 'monospace',
          background: '#fff8f0',
          minHeight: '100vh',
          color: '#2b211a',
        }}>
          <h1 style={{ color: '#b91c1c', marginBottom: '1rem' }}>
            Error al cargar la app
          </h1>
          <pre style={{
            background: '#fee2e2',
            padding: '1rem',
            borderRadius: '8px',
            whiteSpace: 'pre-wrap',
            fontSize: '0.85rem',
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
