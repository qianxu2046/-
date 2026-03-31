import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Sparkles, Copy, Check, Clock, FileText, AlertCircle, Loader2, Trash2 } from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---
interface CopyResult {
  titles: string[];
  body: string;
  tags: string[];
}

interface HistoryRecord {
  id: string;
  timestamp: number;
  productName: string;
  result: CopyResult;
}

// --- Constants ---
const CATEGORIES = [
  '美妆护肤', '服饰穿搭', '食品饮料', '家居生活', 
  '数码3C', '母婴育儿', '宠物用品', '运动户外', '其他'
];

const AUDIENCES = [
  '学生党', '职场白领', '精致宝妈', '成分党', 
  '送礼人群', '健身达人', '租房一族', '全人群'
];

const MAX_HISTORY = 3;
const STORAGE_KEY = 'xhs_copy_history';

export default function App() {
  // --- State ---
  // Inputs
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [productName, setProductName] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [reference, setReference] = useState('');
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
  // Data State
  const [currentResult, setCurrentResult] = useState<CopyResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | string>('current');

  // --- Effects ---
  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, []);

  // --- Handlers ---
  const handleGenerate = async () => {
    if (!productName.trim() || !sellingPoints.trim()) {
      setError('请填写商品名称和核心卖点');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const prompt = `
        商品品类：${category}
        目标人群：${audience}
        商品名称：${productName}
        核心卖点：${sellingPoints}
        ${reference ? `竞品爆款参考（请深度分析并模仿其行文结构、断句节奏、痛点引入方式和情绪铺垫）：\n${reference}` : ''}
        
        请根据以上信息，撰写一篇小红书种草风的图文推广文案。
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: "你是一个拥有百万粉丝的小红书顶级带货博主和电商文案操盘手。你的任务是根据用户提供的商品信息，撰写极具种草感、高转化率的小红书爆款图文文案。文案必须严格遵守小红书的平台调性：多用Emoji，语气亲切像闺蜜分享，排版清晰，段落简短。正文字数严格控制在800字以内。",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3到5个极具吸引力的小红书爆款标题备选，带Emoji"
              },
              body: {
                type: Type.STRING,
                description: "小红书种草文案正文，排版精美，包含适当的Emoji，字数严格控制在800字以内"
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "相关的小红书热门话题标签，以#开头，例如 #好物分享 #美妆"
              }
            },
            required: ["titles", "body", "tags"]
          }
        }
      });

      if (!response.text) throw new Error('AI 返回内容为空');
      
      const result: CopyResult = JSON.parse(response.text);
      setCurrentResult(result);
      setActiveTab('current');

      // Update History
      const newRecord: HistoryRecord = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        productName,
        result
      };

      const updatedHistory = [newRecord, ...history].slice(0, MAX_HISTORY);
      setHistory(updatedHistory);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));

    } catch (err: any) {
      console.error('Generation Error:', err);
      setError(err.message || '生成文案时发生错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const clearHistory = () => {
    if (window.confirm('确定要清空所有历史记录吗？')) {
      setHistory([]);
      localStorage.removeItem(STORAGE_KEY);
      if (activeTab !== 'current') setActiveTab('current');
    }
  };

  // --- Render Helpers ---
  const getDisplayResult = () => {
    if (activeTab === 'current') return currentResult;
    const record = history.find(h => h.id === activeTab);
    return record ? record.result : null;
  };

  const displayResult = getDisplayResult();

  const formatFullTextToCopy = (res: CopyResult) => {
    return `【备选标题】\n${res.titles.join('\n')}\n\n【正文】\n${res.body}\n\n【标签】\n${res.tags.join(' ')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col md:flex-row">
      
      {/* ⬅️ 左栏：创作控制台 */}
      <div className="w-full md:w-[450px] lg:w-[500px] bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100 bg-white z-10">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-red-500">
            <Sparkles className="w-6 h-6" />
            爆款文案生成器
          </h1>
          <p className="text-sm text-gray-500 mt-1">专为小红书种草打造的效率工具</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 基础设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">商品品类</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">目标人群</label>
              <select 
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              >
                {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* 商品信息 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              商品名称 <span className="text-red-500">*</span>
            </label>
            <input 
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="例如：极光焕白精华液"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              核心卖点 <span className="text-red-500">*</span>
            </label>
            <textarea 
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              placeholder="请罗列产品的核心优势，例如：&#10;1. 7天提亮肤色&#10;2. 质地清爽不黏腻&#10;3. 敏感肌可用"
              rows={4}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none"
            />
          </div>

          {/* 竞品参考 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">竞品爆款参考 (选填)</label>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">AI将模仿其结构</span>
            </div>
            <textarea 
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="将小红书上的爆款文案粘贴到这里，AI 会深度学习它的行文节奏和情绪铺垫..."
              rows={5}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-white z-10">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium rounded-xl shadow-sm shadow-red-200 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在创作中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                一键生成爆款文案
              </>
            )}
          </button>
        </div>
      </div>

      {/* ➡️ 右栏：结果与历史区 */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50/50">
        
        {/* 顶部导航 Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 pt-4 flex items-end gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('current')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'current' 
                ? 'border-red-500 text-red-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              当前创作
            </div>
          </button>
          
          {history.map((record, index) => (
            <button
              key={record.id}
              onClick={() => setActiveTab(record.id)}
              className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === record.id 
                  ? 'border-red-500 text-red-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                历史 {index + 1}: {record.productName.slice(0, 6)}{record.productName.length > 6 ? '...' : ''}
              </div>
            </button>
          ))}

          {history.length > 0 && (
            <div className="ml-auto pb-3 pl-4">
              <button 
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                title="清空历史记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空
              </button>
            </div>
          )}
        </div>

        {/* 内容展示区 */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          {!displayResult ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-gray-300" />
              </div>
              <p>填写左侧信息，点击生成获取爆款文案</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
              
              {/* 标题区 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-1 h-5 bg-red-500 rounded-full"></span>
                    爆款标题备选
                  </h3>
                  <button 
                    onClick={() => handleCopy(displayResult.titles.join('\n'), 'titles')}
                    className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    {copiedStates['titles'] ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copiedStates['titles'] ? '已复制' : '复制标题'}
                  </button>
                </div>
                <div className="space-y-3">
                  {displayResult.titles.map((title, idx) => (
                    <div key={idx} className="p-3 bg-red-50/50 rounded-xl text-gray-800 font-medium border border-red-100/50 hover:bg-red-50 transition-colors cursor-pointer" onClick={() => handleCopy(title, `title-${idx}`)}>
                      {title}
                    </div>
                  ))}
                </div>
              </div>

              {/* 正文区 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-1 h-5 bg-red-500 rounded-full"></span>
                    种草正文
                  </h3>
                  <button 
                    onClick={() => handleCopy(displayResult.body, 'body')}
                    className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    {copiedStates['body'] ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copiedStates['body'] ? '已复制' : '复制正文'}
                  </button>
                </div>
                <div className="prose prose-red max-w-none">
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                    {displayResult.body}
                  </div>
                </div>
              </div>

              {/* 标签区 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-1 h-5 bg-red-500 rounded-full"></span>
                    热门话题
                  </h3>
                  <button 
                    onClick={() => handleCopy(displayResult.tags.join(' '), 'tags')}
                    className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    {copiedStates['tags'] ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copiedStates['tags'] ? '已复制' : '复制标签'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayResult.tags.map((tag, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-gray-100 text-blue-600 rounded-full text-sm font-medium cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleCopy(tag, `tag-${idx}`)}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* 底部操作区 */}
        {displayResult && (
          <div className="bg-white border-t border-gray-200 p-4 shrink-0 z-10">
            <div className="max-w-3xl mx-auto flex justify-end">
              <button
                onClick={() => handleCopy(formatFullTextToCopy(displayResult), 'all')}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {copiedStates['all'] ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    全部复制成功
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    一键复制全部内容
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
