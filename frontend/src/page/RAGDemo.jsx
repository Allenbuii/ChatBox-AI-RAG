import React, { useState } from 'react';
import { Play, FileText, Search, Zap, TrendingUp, Layers, GitBranch, CheckCircle, AlertCircle } from 'lucide-react';

const RAGDemo = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [question, setQuestion] = useState('What is Task Decomposition?');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState([]);

  const ragMethods = {
    basic: {
      title: 'Basic RAG',
      icon: <FileText className="w-6 h-6" />,
      color: 'blue',
      diagram: (
        <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mb-2">Q</div>
            <p className="text-sm">Question</p>
          </div>
          <div className="text-3xl text-blue-500">→</div>
          <div className="text-center">
            <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mb-2">🔍</div>
            <p className="text-sm">Retriever</p>
          </div>
          <div className="text-3xl text-purple-500">→</div>
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mb-2">LLM</div>
            <p className="text-sm">Generate</p>
          </div>
          <div className="text-3xl text-green-500">→</div>
          <div className="text-center">
            <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold mb-2">A</div>
            <p className="text-sm">Answer</p>
          </div>
        </div>
      ),
      description: 'Simple RAG: Query → Retrieve → Generate',
      steps: ['Load question', 'Retrieve relevant docs', 'Generate answer with LLM']
    },
    multiquery: {
      title: 'Multi-Query RAG',
      icon: <Search className="w-6 h-6" />,
      color: 'purple',
      diagram: (
        <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
          <div className="flex items-start justify-center gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mb-2">Q</div>
              <p className="text-sm">Original Question</p>
            </div>
            <div className="flex flex-col gap-2 items-center justify-center">
              <div className="text-2xl text-purple-500">→</div>
              <div className="w-24 h-16 bg-purple-400 rounded flex items-center justify-center text-white text-xs">LLM<br/>Generate<br/>Variants</div>
              <div className="text-2xl text-purple-500">→</div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="w-32 h-8 bg-pink-300 rounded flex items-center justify-center text-white text-xs">Query 1</div>
              <div className="w-32 h-8 bg-pink-400 rounded flex items-center justify-center text-white text-xs">Query 2</div>
              <div className="w-32 h-8 bg-pink-500 rounded flex items-center justify-center text-white text-xs">Query 3</div>
              <div className="w-32 h-8 bg-pink-600 rounded flex items-center justify-center text-white text-xs">Query 4</div>
              <div className="w-32 h-8 bg-pink-700 rounded flex items-center justify-center text-white text-xs">Query 5</div>
            </div>
            <div className="text-2xl text-pink-500">→</div>
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mb-2">📚</div>
              <p className="text-sm">Retrieve &<br/>Deduplicate</p>
            </div>
          </div>
        </div>
      ),
      description: 'Generate 5 query perspectives for better retrieval',
      steps: ['Generate 5 query variants', 'Retrieve docs for each', 'Deduplicate results', 'Generate final answer']
    },
    fusion: {
      title: 'RAG-Fusion',
      icon: <Zap className="w-6 h-6" />,
      color: 'yellow',
      diagram: (
        <div className="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold">Q</div>
              <div className="text-2xl">→</div>
              <div className="w-24 h-12 bg-yellow-400 rounded flex items-center justify-center text-white text-xs">Generate<br/>4 Queries</div>
              <div className="text-2xl">→</div>
              <div className="flex flex-col gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-24 h-6 bg-orange-300 rounded flex items-center justify-center text-white text-xs">Q{i}</div>
                ))}
              </div>
            </div>
            <div className="text-2xl text-orange-500">↓</div>
            <div className="w-full flex items-center justify-center gap-4 p-4 bg-orange-100 rounded-lg">
              <div className="text-center">
                <div className="w-20 h-20 bg-orange-500 rounded flex items-center justify-center text-white font-bold mb-2">RRF</div>
                <p className="text-xs">Reciprocal<br/>Rank Fusion</p>
              </div>
              <div className="text-xl">→</div>
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mb-2">⭐</div>
                <p className="text-xs">Re-ranked<br/>Results</p>
              </div>
            </div>
          </div>
        </div>
      ),
      description: 'Generate related queries + Reciprocal Rank Fusion',
      steps: ['Generate 4 related queries', 'Retrieve for each', 'Re-rank with RRF algorithm', 'Generate answer']
    },
    decomposition: {
      title: 'Decomposition',
      icon: <Layers className="w-6 h-6" />,
      color: 'green',
      diagram: (
        <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="w-full bg-green-500 text-white p-3 rounded-lg text-center font-bold">
              Complex Question
            </div>
            <div className="text-2xl text-green-500">↓</div>
            <div className="w-full flex justify-around">
              <div className="text-center">
                <div className="w-24 h-16 bg-green-300 rounded flex items-center justify-center text-white text-xs mb-2">Sub-Q 1</div>
                <div className="text-sm">↓</div>
                <div className="w-24 h-12 bg-green-400 rounded flex items-center justify-center text-white text-xs">Answer 1</div>
              </div>
              <div className="text-center">
                <div className="w-24 h-16 bg-green-400 rounded flex items-center justify-center text-white text-xs mb-2">Sub-Q 2</div>
                <div className="text-sm">↓</div>
                <div className="w-24 h-12 bg-green-500 rounded flex items-center justify-center text-white text-xs">Answer 2</div>
              </div>
              <div className="text-center">
                <div className="w-24 h-16 bg-green-500 rounded flex items-center justify-center text-white text-xs mb-2">Sub-Q 3</div>
                <div className="text-sm">↓</div>
                <div className="w-24 h-12 bg-green-600 rounded flex items-center justify-center text-white text-xs">Answer 3</div>
              </div>
            </div>
            <div className="text-2xl text-emerald-500">↓</div>
            <div className="w-full bg-emerald-500 text-white p-3 rounded-lg text-center font-bold">
              Synthesized Final Answer
            </div>
          </div>
        </div>
      ),
      description: 'Break complex questions into sub-questions',
      steps: ['Decompose into 3 sub-questions', 'Answer each recursively', 'Synthesize final answer']
    },
    stepback: {
      title: 'Step-Back',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'indigo',
      diagram: (
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg">
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-16 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                Specific Question
              </div>
              <div className="text-xl text-indigo-500">↓</div>
              <div className="w-32 h-16 bg-indigo-300 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                Step-Back<br/>Generic Question
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-24 h-12 bg-blue-400 rounded flex items-center justify-center text-white text-xs">Retrieve<br/>Specific</div>
                <div className="text-xl">→</div>
                <div className="w-24 h-12 bg-blue-500 rounded flex items-center justify-center text-white text-xs">Context 1</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-12 bg-purple-400 rounded flex items-center justify-center text-white text-xs">Retrieve<br/>Generic</div>
                <div className="text-xl">→</div>
                <div className="w-24 h-12 bg-purple-500 rounded flex items-center justify-center text-white text-xs">Context 2</div>
              </div>
            </div>
            <div className="text-2xl text-blue-500">→</div>
            <div className="text-center">
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mb-2">LLM</div>
              <p className="text-sm">Comprehensive<br/>Answer</p>
            </div>
          </div>
        </div>
      ),
      description: 'Generate broader context with step-back questions',
      steps: ['Generate step-back question', 'Retrieve for both questions', 'Combine contexts', 'Generate answer']
    },
    hyde: {
      title: 'HyDE',
      icon: <GitBranch className="w-6 h-6" />,
      color: 'pink',
      diagram: (
        <div className="p-6 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between">
                <div className="w-24 h-16 bg-pink-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  Question
                </div>
                <div className="text-2xl text-pink-500">→</div>
                <div className="w-32 h-16 bg-pink-400 rounded-lg flex items-center justify-center text-white text-xs">
                  LLM Generate<br/>Hypothetical Doc
                </div>
                <div className="text-2xl text-pink-500">→</div>
                <div className="w-24 h-16 bg-pink-300 rounded-lg flex items-center justify-center text-white text-xs">
                  Fake<br/>Answer
                </div>
              </div>
            </div>
            <div className="text-2xl text-rose-500">↓</div>
            <div className="w-full max-w-md flex items-center justify-center gap-4">
              <div className="w-32 h-20 bg-rose-400 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                Embed &<br/>Search
              </div>
              <div className="text-2xl">→</div>
              <div className="w-32 h-20 bg-rose-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                Similar<br/>Real Docs
              </div>
            </div>
            <div className="text-2xl text-rose-500">↓</div>
            <div className="w-40 h-16 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
              Final Answer
            </div>
          </div>
        </div>
      ),
      description: 'Generate hypothetical document for better retrieval',
      steps: ['Generate hypothetical answer', 'Use it for retrieval', 'Get similar real docs', 'Generate final answer']
    }
  };

  const simulateRun = async (method) => {
    setIsRunning(true);
    setResult('');
    setLogs([]);
    
    const addLog = (msg, type = 'info') => {
      setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    };

    try {
      addLog(`Starting ${ragMethods[method].title}...`, 'info');
      
      for (let i = 0; i < ragMethods[method].steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        addLog(`✓ ${ragMethods[method].steps[i]}`, 'success');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockAnswer = `This is a simulated answer using ${ragMethods[method].title}. 

Task Decomposition is the process of breaking down complex tasks into smaller, manageable sub-tasks. This technique is particularly important for LLM agents because:

1. It allows the agent to handle complex problems systematically
2. Each sub-task can be addressed with focused context
3. Results can be validated at each step
4. The approach mirrors human problem-solving strategies

The ${ragMethods[method].title} method enhances this by: ${ragMethods[method].description}`;
      
      setResult(mockAnswer);
      addLog('✓ Answer generated successfully!', 'success');
      
    } catch (error) {
      addLog(`✗ Error: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const currentMethod = ragMethods[activeTab];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🚀 RAG From Scratch - Interactive Demo
          </h1>
          <p className="text-gray-600">
            Explore different RAG techniques with visual diagrams and live demonstrations
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {Object.entries(ragMethods).map(([key, method]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === key
                    ? `bg-${method.color}-500 text-white shadow-md`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {method.icon}
                {method.title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Diagram & Info */}
          <div className="space-y-6">
            {/* Method Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                {currentMethod.icon}
                {currentMethod.title}
              </h2>
              <p className="text-gray-600 mb-4 text-lg">
                {currentMethod.description}
              </p>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h3 className="font-bold text-blue-800 mb-2">Process Steps:</h3>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  {currentMethod.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Diagram */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Flow Diagram</h3>
              {currentMethod.diagram}
            </div>
          </div>

          {/* Right Panel - Execution */}
        </div>

        {/* Footer */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 text-center">
          <p className="text-gray-600">
            💡 This is a simulation for educational purposes. Connect to the actual Python backend for real RAG execution.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RAGDemo;