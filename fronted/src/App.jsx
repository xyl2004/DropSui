import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import './App.css'

function App() {
  const refreshTimerRef = useRef(null)
  
  // 用户认证状态
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' 或 'register'
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  
  // 钱包管理状态
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [wallets, setWallets] = useState([])
  const [activeWallet, setActiveWallet] = useState(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [newWalletName, setNewWalletName] = useState('')
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [selectedWalletPrivateKey, setSelectedWalletPrivateKey] = useState('')
  
  // 导入钱包相关状态
  const [showImportModal, setShowImportModal] = useState(false)
  const [importWalletName, setImportWalletName] = useState('')
  const [importPrivateKey, setImportPrivateKey] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [privateKeyValidation, setPrivateKeyValidation] = useState({ isValid: false, format: null })
  
  // 定投相关状态
  const [showDcaModal, setShowDcaModal] = useState(false)
  const [dcaPlans, setDcaPlans] = useState([])
  const [dcaLoading, setDcaLoading] = useState(false)
  const [dcaError, setDcaError] = useState('')
  const [showCreateDca, setShowCreateDca] = useState(false)
  const [newDcaPlan, setNewDcaPlan] = useState({
    planName: '',
    tokenSymbol: 'USDB',
    amount: '',
    targetAddress: '',
    bucketStrategy: 'NONE' // 添加理财策略字段
  })
  const [editingDca, setEditingDca] = useState(null)
  
  // Bucket Protocol 理财相关状态
  const [bucketStrategies, setBucketStrategies] = useState({})
  const [savingPools, setSavingPools] = useState({})
  const [userSavings, setUserSavings] = useState({})
  const [bucketLoading, setBucketLoading] = useState(false)
  const [expectedReturn, setExpectedReturn] = useState(null)
  
  // 提币相关状态
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedPlanForWithdraw, setSelectedPlanForWithdraw] = useState(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [availableBalance, setAvailableBalance] = useState(0)
  const [withdrawSuccess, setWithdrawSuccess] = useState(null)
  
  // 定投执行计数状态
  const [dcaExecutionCounts, setDcaExecutionCounts] = useState([])
  // 已执行次数状态
  const [executedCounts, setExecutedCounts] = useState({})
  
  // 交易记录相关状态
  const [showTransactionsModal, setShowTransactionsModal] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsError, setTransactionsError] = useState('')
  const [selectedPlanForTransactions, setSelectedPlanForTransactions] = useState(null)
  
  // 获取指定定投计划的已执行次数（从状态中获取）
  const getExecutionCount = (planId) => {
    return executedCounts[planId] || 0
  }
  
  // 获取所有定投计划的已执行次数
  const fetchExecutedCounts = async () => {
    try {
      const { data: dcaPlans } = await supabase
        .from('dca_plans')
        .select('id')
        .eq('user_id', user?.id)
      
      if (!dcaPlans || dcaPlans.length === 0) {
        setExecutedCounts({})
        return
      }
      
      const counts = {}
      for (const plan of dcaPlans) {
        const { data: transactions } = await supabase
          .from('transactions')
          .select('id')
          .eq('dca_plan_id', plan.id)
          .eq('status', 'confirmed')
        
        counts[plan.id] = transactions ? transactions.length : 0
      }
      
      setExecutedCounts(counts)
    } catch (error) {
      console.error('获取已执行次数失败:', error)
    }
  }

  // 获取定投记录
  const fetchTransactions = async (planId = null) => {
    try {
      setTransactionsLoading(true)
      setTransactionsError('')
      
      let query = supabase
        .from('transactions')
        .select(`
          *,
          dca_plans!inner(
            id,
            plan_name,
            token_symbol,
            amount
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      
      // 如果指定了定投计划ID，则只查询该计划的定投记录
      if (planId) {
        query = query.eq('dca_plan_id', planId)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('获取定投记录失败:', error)
        setTransactionsError('获取定投记录失败')
        return
      }
      
      setTransactions(data || [])
    } catch (error) {
      console.error('获取定投记录异常:', error)
      setTransactionsError('网络错误，请稍后重试')
    } finally {
      setTransactionsLoading(false)
    }
  }

  // 打开定投记录模态框
  const openTransactionsModal = (planId = null) => {
    setSelectedPlanForTransactions(planId)
    setShowTransactionsModal(true)
    fetchTransactions(planId)
  }

  // Bucket Protocol 理财相关函数
  const fetchBucketStrategies = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/bucket/strategies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setBucketStrategies(data.strategies)
      }
    } catch (error) {
      console.error('获取理财策略失败:', error)
    }
  }

  const fetchSavingPools = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/bucket/saving-pools`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSavingPools(data.pools)
      }
    } catch (error) {
      console.error('获取储蓄池信息失败:', error)
    }
  }

  const fetchUserSavings = async (address) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/bucket/user-savings/${address}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUserSavings(data.savings)
      }
    } catch (error) {
      console.error('获取用户储蓄信息失败:', error)
    }
  }

  // 获取Bucket Protocol实时APR数据
  const fetchBucketAPR = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/bucket/apr`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.pools) {
          // 获取SUSDB储蓄池的数据
          const susdbPoolKey = Object.keys(data.pools).find(key => 
            key.includes('susdb::SUSDB')
          )
          
          if (susdbPoolKey) {
            const pool = data.pools[susdbPoolKey]
            
            // 使用后端计算的总APR
            const totalAPR = pool.totalAPR || 0
            const annualReturn = pool.totalAPRPercent || `${totalAPR.toFixed(2)}%`
            
            setExpectedReturn({
              annualReturn: annualReturn,
              dailyReturn: (totalAPR / 365).toFixed(4) + '%',
              strategy: 'SAVING_POOL',
              source: 'Bucket Protocol实时数据',
              timestamp: data.timestamp,
              breakdown: {
                savingRate: pool.savingRate,
                rewardRate: pool.rewardRate,
                totalAPR: totalAPR
              }
            })
            
            console.log('✅ 获取到实时APR:', annualReturn)
            console.log('📊 APR详情:', {
              基础储蓄利率: `${(pool.savingRate * 100).toFixed(2)}%`,
              奖励利率: pool.rewardRate,
              总APR: annualReturn
            })
          }
        }
      }
    } catch (error) {
      console.error('获取Bucket APR失败:', error)
    }
  }

  const calculateExpectedReturn = async (strategy, amount, timeInDays = 365) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/bucket/calculate-return`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ strategy, amount, timeInDays })
      })
      
      if (response.ok) {
        const data = await response.json()
        setExpectedReturn(data.calculation)
        return data.calculation
      }
    } catch (error) {
      console.error('计算预期收益失败:', error)
    }
  }

  const executeBucketDCA = async (userAddress, amount, strategy) => {
    try {
      setBucketLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/bucket/execute-dca`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userAddress, amount, strategy })
      })
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('执行Bucket理财失败:', error)
      return { success: false, error: error.message }
    } finally {
      setBucketLoading(false)
    }
  }

  // 获取理财策略标签
  const getStrategyLabel = (strategy) => {
    const strategyMap = {
      'NONE': '传统转账',
      'SAVING_POOL': '储蓄池定投'
    }
    return strategyMap[strategy] || '未知策略'
  }

  // 获取理财策略风险等级
  const getStrategyRisk = (strategy) => {
    const riskMap = {
      'NONE': { level: 'NONE', color: '#6b7280', text: '无风险' },
      'SAVING_POOL': { level: 'LOW', color: '#10b981', text: '低风险' }
    }
    return riskMap[strategy] || { level: 'UNKNOWN', color: '#6b7280', text: '未知' }
  }

  // 获取理财策略预期收益
  const getStrategyReturn = (strategy) => {
    if (strategy === 'SAVING_POOL' && expectedReturn?.annualReturn) {
      return expectedReturn.annualReturn
    }
    
    const returnMap = {
      'NONE': '0%',
      'SAVING_POOL': '获取中...'
    }
    return returnMap[strategy] || '未知'
  }

  // 提币相关函数
  const openWithdrawModal = async (plan) => {
    setSelectedPlanForWithdraw(plan)
    setWithdrawAmount('')
    setWithdrawError('')
    
    // 获取可用余额
    try {
      const balance = await getPlanAvailableBalance(plan.id)
      setAvailableBalance(balance)
    } catch (error) {
      console.error('获取可用余额失败:', error)
      setWithdrawError('获取余额失败')
    }
    
    setShowWithdrawModal(true)
  }

  const getPlanAvailableBalance = async (planId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans/${planId}/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.balance || 0
      }
      return 0
    } catch (error) {
      console.error('获取计划余额失败:', error)
      return 0
    }
  }

  const executeWithdraw = async () => {
    if (!selectedPlanForWithdraw || !withdrawAmount) {
      setWithdrawError('请填写提币金额')
      return
    }

    const amount = parseFloat(withdrawAmount)
    if (amount <= 0) {
      setWithdrawError('提币金额必须大于0')
      return
    }

    if (amount > availableBalance) {
      setWithdrawError('提币金额不能超过可用余额')
      return
    }

    try {
      setWithdrawLoading(true)
      setWithdrawError('')
      
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans/${selectedPlanForWithdraw.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          planId: selectedPlanForWithdraw.id
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // 提币成功
        setWithdrawSuccess({
          message: '提币成功！',
          hash: data.hash,
          amount: amount,
          tokenSymbol: selectedPlanForWithdraw.token_symbol
        })
        setShowWithdrawModal(false)
        setSelectedPlanForWithdraw(null)
        setWithdrawAmount('')
        
        // 刷新余额和定投计划
        await fetchDcaPlans()
        
        // 3秒后自动隐藏成功消息
        setTimeout(() => {
          setWithdrawSuccess(null)
        }, 5000)
      } else {
        setWithdrawError(data.error || '提币失败')
      }
    } catch (error) {
      console.error('提币失败:', error)
      setWithdrawError('提币请求失败')
    } finally {
      setWithdrawLoading(false)
    }
  }

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false)
    setSelectedPlanForWithdraw(null)
    setWithdrawAmount('')
    setWithdrawError('')
    setAvailableBalance(0)
    setWithdrawSuccess(null)
  }


  // 认证相关函数
  const API_BASE_URL = 'http://localhost:5001/api'

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const endpoint = authMode === 'login' ? '/login' : '/register'
      const body = authMode === 'login' 
        ? { username: authForm.username, password: authForm.password }
        : { 
            username: authForm.username, 
            email: authForm.email, 
            password: authForm.password 
          }

      // 验证注册表单
      if (authMode === 'register') {
        if (authForm.password !== authForm.confirmPassword) {
          setAuthError('密码确认不匹配')
          setAuthLoading(false)
          return
        }
        if (authForm.password.length < 6) {
          setAuthError('密码长度至少6位')
          setAuthLoading(false)
          return
        }
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        // 保存token和用户信息
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setUser(data.user)
        setShowAuthModal(false)
        setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
      } else {
        setAuthError(data.error || '操作失败')
      }
    } catch (error) {
      console.error('认证错误:', error)
      setAuthError('网络错误，请稍后重试')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const openAuthModal = (mode) => {
    setAuthMode(mode)
    setShowAuthModal(true)
    setAuthError('')
    setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
  }

  // 钱包管理函数
  const fetchWallets = async () => {
    if (!user) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/wallets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setWallets(data.wallets)
        const active = data.wallets.find(w => w.is_active)
        setActiveWallet(active)
      }
    } catch (error) {
      console.error('获取钱包列表失败:', error)
    }
  }

  const createWallet = async () => {
    if (!newWalletName.trim()) {
      setWalletError('请输入钱包名称')
      return
    }

    setWalletLoading(true)
    setWalletError('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/wallets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walletName: newWalletName })
      })

      if (response.ok) {
        const data = await response.json()
        setWallets([data.wallet, ...wallets])
        setActiveWallet(data.wallet)
        setNewWalletName('')
        setShowWalletModal(false)
      } else {
        const errorData = await response.json()
        setWalletError(errorData.error || '创建钱包失败')
      }
    } catch (error) {
      console.error('创建钱包失败:', error)
      setWalletError('网络错误，请稍后重试')
    } finally {
      setWalletLoading(false)
    }
  }

  const switchWallet = async (walletId) => {
    try {
      console.log('切换钱包到:', walletId)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/wallets/${walletId}/activate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        console.log('钱包切换成功')
        // 重新获取钱包列表以确保数据同步
        await fetchWallets()
      } else {
        const errorData = await response.json()
        console.error('切换钱包失败:', errorData)
        setWalletError(errorData.error || '切换钱包失败')
      }
    } catch (error) {
      console.error('切换钱包失败:', error)
      setWalletError('网络错误，请稍后重试')
    }
  }

  const exportPrivateKey = async (walletId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/wallets/${walletId}/private-key`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('API响应数据:', data)
        console.log('私钥长度:', data.private_key ? data.private_key.length : 'undefined')
        console.log('私钥前50字符:', data.private_key ? data.private_key.substring(0, 50) : 'undefined')
        setSelectedWalletPrivateKey(data.private_key)
        setShowPrivateKey(true)
      } else {
        console.error('API响应错误:', response.status, response.statusText)
        const errorData = await response.text()
        console.error('错误详情:', errorData)
      }
    } catch (error) {
      console.error('获取私钥失败:', error)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板')
    }).catch(() => {
      alert('复制失败，请手动复制')
    })
  }

  const deleteWallet = async (walletId) => {
    if (!confirm('确定要删除这个钱包吗？此操作不可撤销！')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/wallets/${walletId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const updatedWallets = wallets.filter(w => w.id !== walletId)
        setWallets(updatedWallets)
        if (activeWallet && activeWallet.id === walletId) {
          setActiveWallet(updatedWallets[0] || null)
        }
      }
    } catch (error) {
      console.error('删除钱包失败:', error)
    }
  }

  // 验证私钥格式（支持多种格式）
  const validatePrivateKey = (privateKey) => {
    const trimmed = privateKey.trim()
    
    // 只支持Sui格式私钥
    if (trimmed.startsWith('suiprivkey1')) {
      return { isValid: true, format: 'sui' }
    }
    
    return { isValid: false, format: null }
  }

  // 处理私钥输入变化
  const handlePrivateKeyChange = (value) => {
    setImportPrivateKey(value)
    if (value.trim()) {
      const validation = validatePrivateKey(value)
      setPrivateKeyValidation(validation)
    } else {
      setPrivateKeyValidation({ isValid: false, format: null })
    }
  }

  const importWallet = async () => {
    if (!importWalletName.trim()) {
      setWalletError('请输入钱包名称')
      return
    }

    if (!importPrivateKey.trim()) {
      setWalletError('请输入私钥')
      return
    }

    // 前端验证私钥格式
    const validation = validatePrivateKey(importPrivateKey)
    if (!validation.isValid) {
      setWalletError('私钥格式不正确！只支持Sui格式(suiprivkey1...)。')
      return
    }

    setImportLoading(true)
    setWalletError('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/wallets/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          walletName: importWalletName.trim(),
          privateKey: importPrivateKey.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setWallets([data.wallet, ...wallets])
        setActiveWallet(data.wallet)
        setImportWalletName('')
        setImportPrivateKey('')
        setShowImportModal(false)
        setWalletError('')
      } else {
        const errorData = await response.json()
        setWalletError(errorData.error || '导入钱包失败')
      }
    } catch (error) {
      console.error('导入钱包失败:', error)
      setWalletError('网络错误，请稍后重试')
    } finally {
      setImportLoading(false)
    }
  }

  // 获取定投执行计数
  const fetchDcaExecutionCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('dca_execution_counts')
        .select(`
          *,
          dca_plans!inner(
            id,
            plan_name,
            user_id,
            is_active
          )
        `)
        .eq('dca_plans.user_id', user?.id)

      if (error) {
        console.error('获取定投执行计数失败:', error)
        return
      }

      setDcaExecutionCounts(data || [])
    } catch (error) {
      console.error('获取定投执行计数异常:', error)
    }
  }

  // 定投相关函数
  const fetchDcaPlans = async () => {
    try {
      setDcaLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setDcaPlans(data.dcaPlans || [])
        // 获取定投计划后，同时获取执行计数和已执行次数
        await fetchDcaExecutionCounts()
        await fetchExecutedCounts()
      } else {
        const errorData = await response.json()
        setDcaError(errorData.error || '获取定投计划失败')
      }
    } catch (error) {
      console.error('获取定投计划失败:', error)
      setDcaError('网络错误，请稍后重试')
    } finally {
      setDcaLoading(false)
    }
  }

  const createDcaPlan = async () => {
    try {
      // 验证：传统转账模式需要接收地址，Bucket理财模式不需要
      if (newDcaPlan.bucketStrategy === 'NONE' && !newDcaPlan.targetAddress.trim()) {
        setDcaError('传统转账模式需要填写接收地址')
        return
      }
      
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newDcaPlan,
          bucketStrategy: newDcaPlan.bucketStrategy,
          // Bucket理财模式时，targetAddress设为空或Bucket协议地址
          targetAddress: newDcaPlan.bucketStrategy === 'NONE' ? newDcaPlan.targetAddress : 'bucket-protocol'
        })
      })

      if (response.ok) {
        await fetchDcaPlans()
        setNewDcaPlan({ planName: '', tokenSymbol: 'USDB', amount: '', targetAddress: '', bucketStrategy: 'NONE' })
        setShowCreateDca(false)
      } else {
        const errorData = await response.json()
        setDcaError(errorData.error || '创建定投计划失败')
      }
    } catch (error) {
      console.error('创建定投计划失败:', error)
      setDcaError('网络错误，请稍后重试')
    }
  }

  const updateDcaPlan = async (planId, updatedData) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedData)
      })

      if (response.ok) {
        await fetchDcaPlans()
        setEditingDca(null)
      } else {
        const errorData = await response.json()
        setDcaError(errorData.error || '更新定投计划失败')
      }
    } catch (error) {
      console.error('更新定投计划失败:', error)
      setDcaError('网络错误，请稍后重试')
    }
  }

  const startDca = async (planId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans/${planId}/start`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await fetchDcaPlans()
      } else {
        const errorData = await response.json()
        setDcaError(errorData.error || '开始定投失败')
      }
    } catch (error) {
      console.error('开始定投失败:', error)
      setDcaError('网络错误，请稍后重试')
    }
  }

  const stopDca = async (planId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans/${planId}/stop`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await fetchDcaPlans()
      } else {
        const errorData = await response.json()
        setDcaError(errorData.error || '结束定投失败')
      }
    } catch (error) {
      console.error('结束定投失败:', error)
      setDcaError('网络错误，请稍后重试')
    }
  }

  const deleteDcaPlan = async (planId) => {
    if (!confirm('确定要删除这个定投计划吗？此操作不可撤销！')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/dca-plans/${planId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await fetchDcaPlans()
      } else {
        const errorData = await response.json()
        setDcaError(errorData.error || '删除定投计划失败')
      }
    } catch (error) {
      console.error('删除定投计划失败:', error)
      setDcaError('网络错误，请稍后重试')
    }
  }

  // 检查本地存储的用户信息
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  // 用户登录后获取钱包列表和定投计划
  useEffect(() => {
    if (user) {
      fetchWallets()
      fetchDcaPlans()
      fetchBucketStrategies() // 加载理财策略
      fetchBucketAPR() // 获取实时APR数据
    }
  }, [user])

  // 设置每秒自动刷新定时器
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      console.log('自动刷新定投数据...')
      // 如果用户已登录，刷新定投执行计数和已执行次数
      if (user) {
        fetchDcaExecutionCounts()
        fetchExecutedCounts()
      }
    }, 1000) // 每秒刷新

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [])




  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-title">
        <h1>🔢 ESP32传感器实时监控</h1>
        <p>实时显示TCRT5000传感器计数数据</p>
          </div>
          <div className="header-auth">
            {user ? (
              <div className="user-info">
                <span className="welcome-text">欢迎, {user.username}</span>
                <button 
                  className="wallet-btn" 
                  onClick={() => setShowWalletModal(true)}
                >
                  💼 钱包管理
                </button>
                <button className="logout-btn" onClick={handleLogout}>
                  退出登录
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <button 
                  className="auth-btn login-btn" 
                  onClick={() => openAuthModal('login')}
                >
                  登录
                </button>
                <button 
                  className="auth-btn register-btn" 
                  onClick={() => openAuthModal('register')}
                >
                  注册
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 提币成功消息 */}
      {withdrawSuccess && (
        <div className="success-message">
          <div className="success-content">
            <div className="success-icon">✅</div>
            <div className="success-details">
              <h3>{withdrawSuccess.message}</h3>
              <div className="success-info">
                <p><strong>交易哈希:</strong> {withdrawSuccess.hash}</p>
                <p><strong>提币金额:</strong> {withdrawSuccess.amount} {withdrawSuccess.tokenSymbol}</p>
              </div>
            </div>
            <button 
              className="close-success-btn"
              onClick={() => setWithdrawSuccess(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="main">

        {/* 定投模式模块 */}
        {user && (
          <div className="dca-section">
            <div className="dca-header">
              <h2>📈 定投模式</h2>
              <button 
                className="dca-btn"
                onClick={() => setShowDcaModal(true)}
              >
                💼 管理定投
              </button>
            </div>
            
            <div className="dca-plans-grid">
              {dcaPlans.length === 0 ? (
                <div className="no-dca-plans">
                  <p>暂无定投计划</p>
                  <button 
                    className="create-dca-btn"
                    onClick={() => setShowCreateDca(true)}
                  >
                    创建定投计划
                  </button>
                </div>
              ) : (
                dcaPlans.map((plan) => (
                  <div key={plan.id} className={`dca-plan-card ${plan.is_active ? 'active' : ''}`}>
                    <div className="dca-plan-header">
                      <h3>{plan.plan_name}</h3>
                      <div className={`dca-status ${plan.is_active ? 'running' : 'stopped'}`}>
                        {plan.is_active ? '🟢 运行中' : '🔴 已停止'}
                      </div>
                    </div>
                    
                    <div className="dca-plan-details">
                      <div className="dca-detail">
                        <span className="dca-label">币种:</span>
                        <span className="dca-value">{plan.token_symbol}</span>
                      </div>
                      <div className="dca-detail">
                        <span className="dca-label">数量:</span>
                        <span className="dca-value">{plan.amount}</span>
                      </div>
                      <div className="dca-detail">
                        <span className="dca-label">地址:</span>
                        <span className="dca-address">{plan.target_address}</span>
                      </div>
                      <div className="dca-detail execution-count">
                        <span className="dca-label">已执行次数:</span>
                        <span className="dca-value count-badge">{getExecutionCount(plan.id)} 次</span>
                      </div>
                      <div className="dca-detail bucket-strategy">
                        <span className="dca-label">理财策略:</span>
                        <span className={`strategy-badge ${getStrategyRisk(plan.bucket_strategy).level.toLowerCase()}`}>
                          {getStrategyLabel(plan.bucket_strategy)}
                        </span>
                        <span className="expected-return">
                          预期收益: {getStrategyReturn(plan.bucket_strategy)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="dca-plan-actions">
                      {plan.is_active ? (
                        <button 
                          className="dca-action-btn stop-btn"
                          onClick={() => stopDca(plan.id)}
                        >
                          结束定投
                        </button>
                      ) : (
                        <button 
                          className="dca-action-btn start-btn"
                          onClick={() => startDca(plan.id)}
                        >
                          开始定投
                        </button>
                      )}
                      <button 
                        className="dca-action-btn transactions-btn"
                        onClick={() => openTransactionsModal(plan.id)}
                      >
                        📋 定投记录
                      </button>
                      {plan.bucket_strategy !== 'NONE' && (
                        <button 
                          className="dca-action-btn withdraw-btn"
                          onClick={() => openWithdrawModal(plan)}
                        >
                          💰 提取资金
                        </button>
                      )}
                      <button 
                        className="dca-action-btn edit-btn"
                        onClick={() => setEditingDca(plan)}
                      >
                        编辑
                      </button>
                      <button 
                        className="dca-action-btn delete-btn"
                        onClick={() => deleteDcaPlan(plan.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 认证模态框 */}
        {showAuthModal && (
          <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{authMode === 'login' ? '用户登录' : '用户注册'}</h2>
                <button 
                  className="modal-close" 
                  onClick={() => setShowAuthModal(false)}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleAuth} className="auth-form">
                <div className="form-group">
                  <label htmlFor="username">用户名</label>
                  <input
                    type="text"
                    id="username"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                    required
                    placeholder="请输入用户名"
                  />
                </div>

                {authMode === 'register' && (
                  <div className="form-group">
                    <label htmlFor="email">邮箱</label>
                    <input
                      type="email"
                      id="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                      required
                      placeholder="请输入邮箱"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="password">密码</label>
                  <input
                    type="password"
                    id="password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    required
                    placeholder="请输入密码"
                  />
                </div>

                {authMode === 'register' && (
                  <div className="form-group">
                    <label htmlFor="confirmPassword">确认密码</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={authForm.confirmPassword}
                      onChange={(e) => setAuthForm({...authForm, confirmPassword: e.target.value})}
                      required
                      placeholder="请再次输入密码"
                    />
                  </div>
                )}

                {authError && (
                  <div className="error-message">
                    {authError}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={authLoading}
                >
                  {authLoading ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}
                </button>
              </form>

              <div className="modal-footer">
                <p>
                  {authMode === 'login' ? '还没有账号？' : '已有账号？'}
                  <button 
                    className="switch-mode-btn"
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  >
                    {authMode === 'login' ? '立即注册' : '立即登录'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 钱包管理模态框 */}
        {showWalletModal && (
          <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
            <div className="modal-content wallet-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>💼 钱包管理</h2>
                <button 
                  className="modal-close" 
                  onClick={() => setShowWalletModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="wallet-content">
                {/* 当前活跃钱包 */}
                {activeWallet && (
                  <div className="active-wallet">
                    <h3>当前钱包</h3>
                    <div className="wallet-card active">
                      <div className="wallet-info">
                        <div className="wallet-name">{activeWallet.wallet_name}</div>
                        <div className="wallet-address">{activeWallet.address}</div>
                      </div>
                      <div className="wallet-status">✓ 活跃</div>
                    </div>
                  </div>
                )}

                {/* 创建新钱包 */}
                <div className="create-wallet">
                  <h3>创建新钱包</h3>
                  <div className="create-form">
                    <input
                      type="text"
                      placeholder="输入钱包名称"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                    />
                    <button 
                      onClick={createWallet}
                      disabled={walletLoading}
                      className="create-btn"
                    >
                      {walletLoading ? '创建中...' : '创建钱包'}
                    </button>
                    <button 
                      onClick={() => setShowImportModal(true)}
                      className="import-btn"
                    >
                      📥 导入私钥
                    </button>
                  </div>
                  {walletError && (
                    <div className="error-message">{walletError}</div>
                  )}
                </div>

                {/* 钱包列表 */}
                <div className="wallets-list">
                  <h3>我的钱包 ({wallets.length})</h3>
                  {wallets.length === 0 ? (
                    <div className="no-wallets">暂无钱包，请先创建一个</div>
                  ) : (
                    <div className="wallets-grid">
                      {wallets.map((wallet) => (
                        <div 
                          key={wallet.id} 
                          className={`wallet-card ${wallet.is_active ? 'active' : ''}`}
                          onClick={() => switchWallet(wallet.id)}
                        >
                          <div className="wallet-info">
                            <div className="wallet-name">{wallet.wallet_name}</div>
                            <div className="wallet-address">{wallet.address}</div>
                            <div className="wallet-date">
                              {new Date(wallet.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="wallet-actions">
                            {wallet.is_active ? (
                              <div className="wallet-status">✓ 当前活跃</div>
                            ) : (
                              <button 
                                className="action-btn switch-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  switchWallet(wallet.id)
                                }}
                              >
                                切换到此钱包
                              </button>
                            )}
                            <button 
                              className="action-btn export-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                exportPrivateKey(wallet.id)
                              }}
                            >
                              导出私钥
                            </button>
                            <button 
                              className="action-btn delete-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteWallet(wallet.id)
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 私钥显示模态框 */}
        {showPrivateKey && (
          <div className="modal-overlay" onClick={() => setShowPrivateKey(false)}>
            <div className="modal-content private-key-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🔑 私钥</h2>
                <button 
                  className="modal-close" 
                  onClick={() => setShowPrivateKey(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="private-key-content">
                <div className="warning">
                  ⚠️ 请妥善保管您的私钥，不要泄露给他人！
                </div>
                <div className="private-key-display">
                  <textarea 
                    value={selectedWalletPrivateKey}
                    readOnly
                    className="private-key-text"
                  />
                  <button 
                    className="copy-btn"
                    onClick={() => copyToClipboard(selectedWalletPrivateKey)}
                  >
                    复制私钥
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* 导入钱包模态框 */}
          {showImportModal && (
            <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
              <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>📥 导入私钥钱包</h2>
                  <button 
                    className="modal-close" 
                    onClick={() => {
                      setShowImportModal(false)
                      setImportWalletName('')
                      setImportPrivateKey('')
                      setWalletError('')
                      setPrivateKeyValidation({ isValid: false, format: null })
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div className="import-content">
                  <div className="warning">
                    ⚠️ 请确保您输入的私钥是正确的，导入后将成为您的活跃钱包！
                  </div>
                  
                  <div className="form-group">
                    <label>钱包名称 *</label>
                    <input
                      type="text"
                      placeholder="请输入钱包名称"
                      value={importWalletName}
                      onChange={(e) => setImportWalletName(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>私钥 *</label>
                    <textarea
                      placeholder="请输入Sui私钥（suiprivkey1...）"
                      value={importPrivateKey}
                      onChange={(e) => handlePrivateKeyChange(e.target.value)}
                      className={`private-key-input ${importPrivateKey.trim() ? (privateKeyValidation.isValid ? 'valid' : 'invalid') : ''}`}
                      rows="4"
                    />
                    <div className="input-hint">
                      支持格式：<br/>
                      • Sui格式：如 suiprivkey1...<br/>
                      • 示例：suiprivkey1qqxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                    </div>
                    {importPrivateKey.trim() && (
                      <div className={`validation-message ${privateKeyValidation.isValid ? 'success' : 'error'}`}>
                        {privateKeyValidation.isValid ? 
                          `✓ 私钥格式正确 (${privateKeyValidation.format.toUpperCase()})` : 
                          '✗ 私钥格式不正确，只支持Sui格式(suiprivkey1...)'
                        }
                      </div>
                    )}
                  </div>

                  {walletError && (
                    <div className="error-message">{walletError}</div>
                  )}
                  
                  <div className="form-actions">
                    <button 
                      className="cancel-btn"
                      onClick={() => {
                        setShowImportModal(false)
                        setImportWalletName('')
                        setImportPrivateKey('')
                        setWalletError('')
                        setPrivateKeyValidation({ isValid: false, format: null })
                      }}
                    >
                      取消
                    </button>
                    <button 
                      className="submit-btn"
                      onClick={importWallet}
                      disabled={importLoading || !importWalletName.trim() || !importPrivateKey.trim()}
                    >
                      {importLoading ? '导入中...' : '导入钱包'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 定投管理模态框 */}
        {showDcaModal && (
          <div className="modal-overlay" onClick={() => setShowDcaModal(false)}>
            <div className="modal-content dca-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📈 定投管理</h2>
                <button 
                  className="modal-close" 
                  onClick={() => setShowDcaModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="dca-modal-content">
                <div className="dca-modal-actions">
                  <button 
                    className="create-dca-btn"
                    onClick={() => setShowCreateDca(true)}
                  >
                    ➕ 创建定投计划
                  </button>
                  <button 
                    className="view-all-transactions-btn"
                    onClick={() => openTransactionsModal(null)}
                  >
                    📋 查看所有交易记录
                  </button>
                </div>
                
                {dcaError && (
                  <div className="error-message">{dcaError}</div>
                )}
                
                {dcaLoading ? (
                  <div className="loading">加载中...</div>
                ) : (
                  <div className="dca-plans-list">
                    {dcaPlans.length === 0 ? (
                      <div className="no-dca-plans">
                        <p>暂无定投计划</p>
                      </div>
                    ) : (
                      dcaPlans.map((plan) => (
                        <div key={plan.id} className="dca-plan-item">
                          <div className="dca-plan-info">
                            <h3>{plan.plan_name}</h3>
                            <p>{plan.token_symbol} - {plan.amount}</p>
                            <p className="dca-address">{plan.target_address}</p>
                            <div className="dca-status-row">
                              <span className={`dca-status ${plan.is_active ? 'running' : 'stopped'}`}>
                                {plan.is_active ? '🟢 运行中' : '🔴 已停止'}
                              </span>
                              <span className="execution-count-badge">
                                已执行次数: {getExecutionCount(plan.id)} 次
                              </span>
                            </div>
                            <div className="bucket-strategy-row">
                              <span className={`strategy-badge ${getStrategyRisk(plan.bucket_strategy).level.toLowerCase()}`}>
                                {getStrategyLabel(plan.bucket_strategy)}
                              </span>
                              <span className="expected-return">
                                预期收益: {getStrategyReturn(plan.bucket_strategy)}
                              </span>
                            </div>
                          </div>
                          <div className="dca-plan-actions">
                            {plan.is_active ? (
                              <button 
                                className="dca-action-btn stop-btn"
                                onClick={() => stopDca(plan.id)}
                              >
                                停止
                              </button>
                            ) : (
                              <button 
                                className="dca-action-btn start-btn"
                                onClick={() => startDca(plan.id)}
                              >
                                开始
                              </button>
                            )}
                            <button 
                              className="dca-action-btn transactions-btn"
                              onClick={() => openTransactionsModal(plan.id)}
                            >
                              📋 定投记录
                            </button>
                            {plan.bucket_strategy !== 'NONE' && (
                              <button 
                                className="dca-action-btn withdraw-btn"
                                onClick={() => openWithdrawModal(plan)}
                              >
                                💰 提取资金
                              </button>
                            )}
                            <button 
                              className="dca-action-btn edit-btn"
                              onClick={() => setEditingDca(plan)}
                            >
                              编辑
                            </button>
                            <button 
                              className="dca-action-btn delete-btn"
                              onClick={() => deleteDcaPlan(plan.id)}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 创建/编辑定投计划模态框 */}
        {(showCreateDca || editingDca) && (
          <div className="modal-overlay" onClick={() => {
            setShowCreateDca(false)
            setEditingDca(null)
            setNewDcaPlan({ planName: '', tokenSymbol: 'USDB', amount: '', targetAddress: '', bucketStrategy: 'NONE' })
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingDca ? '✏️ 编辑定投计划' : '➕ 创建定投计划'}</h2>
                <button 
                  className="modal-close" 
                  onClick={() => {
                    setShowCreateDca(false)
                    setEditingDca(null)
                    setNewDcaPlan({ planName: '', tokenSymbol: 'USDB', amount: '', targetAddress: '', bucketStrategy: 'NONE' })
                  }}
                >
                  ×
                </button>
              </div>
              
              <div className="dca-form">
                <div className="form-group">
                  <label>定投名称 *</label>
                  <input
                    type="text"
                    value={editingDca ? editingDca.plan_name : newDcaPlan.planName}
                    onChange={(e) => {
                      if (editingDca) {
                        setEditingDca({...editingDca, plan_name: e.target.value})
                      } else {
                        setNewDcaPlan({...newDcaPlan, planName: e.target.value})
                      }
                    }}
                    placeholder="请输入定投计划名称"
                  />
                </div>
                
                <div className="form-group">
                  <label>定投币种</label>
                  <select
                    value={editingDca ? editingDca.token_symbol : newDcaPlan.tokenSymbol}
                    onChange={(e) => {
                      if (editingDca) {
                        setEditingDca({...editingDca, token_symbol: e.target.value})
                      } else {
                        setNewDcaPlan({...newDcaPlan, tokenSymbol: e.target.value})
                      }
                    }}
                  >
                    <option value="USDB">🏦 USDB (Bucket Protocol 原生稳定币)</option>
                    <option value="SUI">🟢 SUI (Sui 区块链原生代币)</option>
                    <option value="USDC">💵 USDC (USD Coin 美元稳定币)</option>
                    <option value="USDT">💎 USDT (Tether 泰达币)</option>
                  </select>
                  <div className="token-info">
                    {(editingDca ? editingDca.token_symbol : newDcaPlan.tokenSymbol) === 'USDB' && (
                      <div className="token-description">
                        <p><strong>USDB (USD Bucket)</strong> - Bucket Protocol 原生稳定币，与美元 1:1 挂钩，最适合 Bucket 理财策略</p>
                      </div>
                    )}
                    {(editingDca ? editingDca.token_symbol : newDcaPlan.tokenSymbol) === 'SUI' && (
                      <div className="token-description">
                        <p><strong>SUI</strong> - Sui 区块链原生代币，用于支付 gas 费和治理投票</p>
                      </div>
                    )}
                    {(editingDca ? editingDca.token_symbol : newDcaPlan.tokenSymbol) === 'USDC' && (
                      <div className="token-description">
                        <p><strong>USDC</strong> - 由 Circle 发行的美元稳定币，广泛用于 DeFi 协议</p>
                      </div>
                    )}
                    {(editingDca ? editingDca.token_symbol : newDcaPlan.tokenSymbol) === 'USDT' && (
                      <div className="token-description">
                        <p><strong>USDT</strong> - 由 Tether 发行的美元稳定币，市值最大的稳定币</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>定投数量 *</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editingDca ? editingDca.amount : newDcaPlan.amount}
                    onChange={(e) => {
                      if (editingDca) {
                        setEditingDca({...editingDca, amount: e.target.value})
                      } else {
                        setNewDcaPlan({...newDcaPlan, amount: e.target.value})
                      }
                    }}
                    placeholder="请输入定投数量"
                  />
                </div>
                
                {/* 只有传统转账模式才需要接收地址 */}
                {(editingDca ? editingDca.bucket_strategy : newDcaPlan.bucketStrategy) === 'NONE' && (
                  <div className="form-group">
                    <label>接收地址 *</label>
                    <input
                      type="text"
                      value={editingDca ? editingDca.target_address : newDcaPlan.targetAddress}
                      onChange={(e) => {
                        if (editingDca) {
                          setEditingDca({...editingDca, target_address: e.target.value})
                        } else {
                          setNewDcaPlan({...newDcaPlan, targetAddress: e.target.value})
                        }
                      }}
                      placeholder="请输入接收地址"
                    />
                  </div>
                )}
                
                {/* Bucket 理财模式显示说明 */}
                {(editingDca ? editingDca.bucket_strategy : newDcaPlan.bucketStrategy) !== 'NONE' && (
                  <div className="form-group bucket-info">
                    <div className="bucket-mode-notice">
                      <div className="notice-icon">🏦</div>
                      <div className="notice-content">
                        <h4>Bucket Protocol 理财模式</h4>
                        <p>代币将直接存入 Bucket Protocol 储蓄池，无需指定接收地址</p>
                        <p>系统将自动与 Bucket 协议进行交互，获得稳定收益</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="form-group">
                  <label>理财策略 *</label>
                  <select
                    value={editingDca ? editingDca.bucket_strategy : newDcaPlan.bucketStrategy}
                    onChange={(e) => {
                      if (editingDca) {
                        setEditingDca({...editingDca, bucket_strategy: e.target.value})
                      } else {
                        setNewDcaPlan({...newDcaPlan, bucketStrategy: e.target.value})
                      }
                    }}
                  >
                    <option value="NONE">传统转账 (发送到指定地址，0% 收益)</option>
                    <option value="SAVING_POOL">储蓄池定投 (存入Bucket储蓄池，4-8% 年化)</option>
                  </select>
                  <div className="strategy-description">
                    {(editingDca ? editingDca.bucket_strategy : newDcaPlan.bucketStrategy) !== 'NONE' && (
                      <div className="strategy-info">
                        <p className="strategy-risk">
                          风险等级: <span style={{color: getStrategyRisk(editingDca ? editingDca.bucket_strategy : newDcaPlan.bucketStrategy).color}}>
                            {getStrategyRisk(editingDca ? editingDca.bucket_strategy : newDcaPlan.bucketStrategy).text}
                          </span>
                        </p>
                        <p className="strategy-return">
                          预期收益: {getStrategyReturn(editingDca ? editingDca.bucket_strategy : newDcaPlan.bucketStrategy)} 年化
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    className="cancel-btn"
                    onClick={() => {
                      setShowCreateDca(false)
                      setEditingDca(null)
                      setNewDcaPlan({ planName: '', tokenSymbol: 'USDB', amount: '', targetAddress: '', bucketStrategy: 'NONE' })
                    }}
                  >
                    取消
                  </button>
                  <button 
                    className="submit-btn"
                    onClick={() => {
                      if (editingDca) {
                        // 验证：传统转账模式需要接收地址，Bucket理财模式不需要
                        if (editingDca.bucket_strategy === 'NONE' && !editingDca.target_address.trim()) {
                          setDcaError('传统转账模式需要填写接收地址')
                          return
                        }
                        
                        updateDcaPlan(editingDca.id, {
                          planName: editingDca.plan_name,
                          tokenSymbol: editingDca.token_symbol,
                          amount: editingDca.amount,
                          targetAddress: editingDca.bucket_strategy === 'NONE' ? editingDca.target_address : 'bucket-protocol',
                          bucketStrategy: editingDca.bucket_strategy
                        })
                      } else {
                        createDcaPlan()
                      }
                    }}
                  >
                    {editingDca ? '更新' : '创建'}
                  </button>
                </div>
              </div>
            </div>
        </div>
        )}

      {/* 提币模态框 */}
      {showWithdrawModal && (
        <div className="modal-overlay" onClick={closeWithdrawModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💰 提取资金</h2>
              <button 
                className="close-btn"
                onClick={closeWithdrawModal}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {selectedPlanForWithdraw && (
                <div className="withdraw-form">
                  <div className="plan-info">
                    <h3>{selectedPlanForWithdraw.plan_name}</h3>
                    <p>币种: {selectedPlanForWithdraw.token_symbol}</p>
                    <p>理财策略: {getStrategyLabel(selectedPlanForWithdraw.bucket_strategy)}</p>
                    <div className="balance-info">
                      <span className="balance-label">可用余额:</span>
                      <span className="balance-amount">{availableBalance} {selectedPlanForWithdraw.token_symbol}</span>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>提取金额 *</label>
                    <div className="amount-input-group">
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="请输入提取金额"
                        min="0"
                        max={availableBalance}
                        step="0.01"
                      />
                      <span className="token-symbol">{selectedPlanForWithdraw.token_symbol}</span>
                    </div>
                    <div className="amount-options">
                      <button 
                        className="amount-btn"
                        onClick={() => setWithdrawAmount((availableBalance * 0.25).toFixed(2))}
                      >
                        25%
                      </button>
                      <button 
                        className="amount-btn"
                        onClick={() => setWithdrawAmount((availableBalance * 0.5).toFixed(2))}
                      >
                        50%
                      </button>
                      <button 
                        className="amount-btn"
                        onClick={() => setWithdrawAmount((availableBalance * 0.75).toFixed(2))}
                      >
                        75%
                      </button>
                      <button 
                        className="amount-btn"
                        onClick={() => setWithdrawAmount(availableBalance.toString())}
                      >
                        全部
                      </button>
                    </div>
                  </div>
                  
                  {withdrawError && (
                    <div className="error-message">
                      {withdrawError}
                    </div>
                  )}
                  
                  <div className="withdraw-info">
                    <h4>提币说明:</h4>
                    <ul>
                      <li>提币将把资金从理财账户转回您的钱包</li>
                      <li>提币后停止享受理财收益</li>
                      <li>提币操作不可撤销，请谨慎操作</li>
                      <li>提币需要支付少量 gas 费用</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={closeWithdrawModal}
                disabled={withdrawLoading}
              >
                取消
              </button>
              <button 
                className="withdraw-btn"
                onClick={executeWithdraw}
                disabled={withdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              >
                {withdrawLoading ? '提币中...' : '确认提币'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 定投记录模态框 */}
      {showTransactionsModal && (
          <div className="modal-overlay" onClick={() => setShowTransactionsModal(false)}>
            <div className="modal-content transactions-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📋 定投记录</h2>
                <button 
                  className="modal-close" 
                  onClick={() => setShowTransactionsModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="transactions-content">
                {transactionsLoading ? (
                  <div className="loading">加载中...</div>
                ) : transactionsError ? (
                  <div className="error-message">{transactionsError}</div>
                ) : transactions.length === 0 ? (
                  <div className="no-transactions">
                    <p>暂无定投记录</p>
                    <p className="hint">当定投执行成功后，定投记录会显示在这里</p>
                  </div>
                ) : (
                  <div className="transactions-list">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="transaction-item">
                        <div className="transaction-header">
                          <div className="transaction-info">
                            <h3>{transaction.dca_plans?.plan_name || '未知计划'}</h3>
                            <div className="transaction-meta">
                              <span className="transaction-id">#{transaction.id}</span>
                              <span className="transaction-time">
                                {new Date(transaction.created_at).toLocaleString('zh-CN')}
                              </span>
                            </div>
                          </div>
                          <div className={`transaction-status ${transaction.status}`}>
                            {transaction.status === 'confirmed' ? '✅ 已确认' : 
                             transaction.status === 'pending' ? '⏳ 待确认' : 
                             '❌ 失败'}
                          </div>
                        </div>
                        
                        <div className="transaction-details">
                          <div className="transaction-row">
                            <span className="label">交易哈希:</span>
                            <span className="value tx-hash" onClick={() => copyToClipboard(transaction.tx_hash)}>
                              {transaction.tx_hash}
                              <span className="copy-hint">点击复制</span>
                            </span>
                          </div>
                          
                          <div className="transaction-row">
                            <span className="label">用户钱包:</span>
                            <span className="value address">
                              {transaction.wallet_address}
                            </span>
                          </div>
                          
                          <div className="transaction-row">
                            <span className="label">
                              {transaction.transaction_type === 'bucket_withdraw' ? '提币到:' : '投资目标:'}
                            </span>
                            <span className="value address">
                              {transaction.recipient_address}
                            </span>
                          </div>
                          
                          <div className="transaction-row">
                            <span className="label">
                              {transaction.transaction_type === 'bucket_withdraw' ? '提币金额:' : '定投金额:'}
                            </span>
                            <span className="value amount">
                              {transaction.amount} {transaction.token_symbol || transaction.dca_plans?.token_symbol || 'USDB'}
                            </span>
                          </div>
                          
                          <div className="transaction-row">
                            <span className="label">交易类型:</span>
                            <span className="value transaction-type">
                              {transaction.transaction_type === 'bucket_withdraw' ? '💸 提币' : 
                               transaction.transaction_type === 'bucket_investment' ? '💰 定投理财' :
                               transaction.transaction_type === 'dca_investment' ? '📈 定投转账' : '📋 其他'}
                            </span>
                          </div>
                          
                          {transaction.block_number && (
                            <div className="transaction-row">
                              <span className="label">区块号:</span>
                              <span className="value">
                                {transaction.block_number}
                              </span>
                            </div>
                          )}
                          
                          {transaction.error_message && (
                            <div className="transaction-row error">
                              <span className="label">错误信息:</span>
                              <span className="value error-message">
                                {transaction.error_message}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="transaction-actions">
                          <button 
                            className="view-on-explorer-btn"
                            onClick={() => window.open(`https://suiexplorer.com/txblock/${transaction.tx_hash}`, '_blank')}
                          >
                            🔗 在Sui浏览器中查看
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
