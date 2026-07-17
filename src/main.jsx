import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <pre style={{ color: '#ff5c5c', padding: 20, whiteSpace: 'pre-wrap' }}>
        App crashed: {String(this.state.error?.stack || this.state.error)}
      </pre>
    )
    return this.props.children
  }
}

window.addEventListener('error', e => {
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="color:#ff5c5c;padding:20px">JS error: ${e.message} (${e.filename}:${e.lineno})</pre>`)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
)
