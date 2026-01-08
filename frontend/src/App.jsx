import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RAGDocumentQA from './page/RAGDocumentQA'
import RAGDemo from './page/RAGDemo'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RAGDocumentQA />} />
        <Route path="/demo" element={<RAGDemo />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App