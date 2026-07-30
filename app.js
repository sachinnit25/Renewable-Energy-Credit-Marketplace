/**
 * REC Marketplace — App Logic
 *
 * Wallet integration (Freighter), balance display, and XLM
 * transaction flow on the Stellar Testnet.
 *
 * Dependencies (loaded via CDN before this script):
 *   - StellarSdk   (global, v12 UMD)
 *   - freighterApi (global, window.freighterApi from @stellar/freighter-api v6)
 */
;(function () {
  'use strict'

  /* ====================================================
     CONSTANTS & CONFIG
     ==================================================== */
  const HORIZON_URL   = 'https://horizon-testnet.stellar.org'
  const NETWORK       = StellarSdk.Networks.TESTNET
  const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet/tx/'
  const MAX_HISTORY   = 5
  const DETECT_RETRIES = 6
  const DETECT_INTERVAL_MS = 1200

  /* ====================================================
     DOM REFERENCES
     ==================================================== */
  const $ = id => document.getElementById(id)

  const connectBtn   = $('connectBtn')
  const disconnectBtn = $('disconnectBtn')
  const walletStatus = $('walletStatus')
  const walletText   = $('walletText')
  const statusDot    = $('statusDot')
  const copyBtn      = $('copyBtn')

  const balanceDisplay = $('balanceDisplay')
  const balanceAmount  = $('balanceAmount')
  const balanceCurrency = $('balanceCurrency')
  const refreshBtn     = $('refreshBtn')

  const sendForm  = $('sendForm')
  const destInput = $('dest')
  const amountInput = $('amount')
  const sendBtn   = $('sendBtn')
  const txStatusEl = $('txStatus')

  const txHistoryEl = $('txHistory')

  /* ====================================================
     STATE
     ==================================================== */
  const server = new StellarSdk.Server(HORIZON_URL)
  let publicKey = null
  let txHistory = [] // { hash, amount, dest, status }

  /* ====================================================
     FREIGHTER DETECTION
     ==================================================== */

  /**
   * Returns the freighterApi global if available, else null.
   */
  function getFreighter () {
    // The v6 UMD build exposes window.freighterApi
    if (window.freighterApi) return window.freighterApi
    // Some builds may capitalize differently
    if (window.FreighterApi) return window.FreighterApi
    return null
  }

  /**
   * Retry-loop to wait for the extension to inject its global.
   * Returns a promise resolving to the API object or null.
   */
  function detectFreighter () {
    return new Promise(resolve => {
      const api = getFreighter()
      if (api) return resolve(api)

      let tries = 0
      const interval = setInterval(() => {
        tries++
        const api = getFreighter()
        if (api) {
          clearInterval(interval)
          return resolve(api)
        }
        if (tries >= DETECT_RETRIES) {
          clearInterval(interval)
          resolve(null)
        }
      }, DETECT_INTERVAL_MS)
    })
  }

  /* ====================================================
     UI HELPERS
     ==================================================== */

  function setWalletConnected (address) {
    publicKey = address
    const short = address.slice(0, 6) + '…' + address.slice(-6)
    walletText.textContent = short
    walletText.title = address
    walletStatus.classList.add('connected')
    walletStatus.classList.remove('error')
    statusDot.classList.add('active')
    connectBtn.disabled = true
    disconnectBtn.disabled = false
    refreshBtn.disabled = false
    sendBtn.disabled = false
  }

  function setWalletDisconnected () {
    publicKey = null
    walletText.textContent = 'Not connected'
    walletText.title = ''
    walletStatus.classList.remove('connected', 'error')
    statusDot.classList.remove('active')
    connectBtn.disabled = false
    disconnectBtn.disabled = true
    refreshBtn.disabled = true
    sendBtn.disabled = true
    balanceAmount.textContent = '—'
    balanceCurrency.textContent = ''
    balanceDisplay.classList.remove('balance-display--loading')
  }

  function setTxStatus (type, message, hash) {
    // type: idle | pending | success | error
    txStatusEl.className = 'tx-status tx-status--' + type

    const icons = { idle: '💬', pending: '⏳', success: '✅', error: '❌' }
    const iconEl = txStatusEl.querySelector('.tx-icon')
    const msgEl  = txStatusEl.querySelector('.tx-status__message')
    iconEl.textContent = icons[type] || '💬'
    msgEl.textContent = message

    // remove old hash link
    const oldLink = txStatusEl.querySelector('.tx-status__hash')
    if (oldLink) oldLink.remove()

    if (hash) {
      const a = document.createElement('a')
      a.className = 'tx-status__hash'
      a.href = EXPLORER_BASE + hash
      a.target = '_blank'
      a.rel = 'noopener'
      a.textContent = hash
      txStatusEl.querySelector('.tx-status__body').appendChild(a)
    }
  }

  function addToHistory (hash, amount, dest, status) {
    txHistory.unshift({ hash, amount, dest, status })
    if (txHistory.length > MAX_HISTORY) txHistory.pop()
    renderHistory()
  }

  function renderHistory () {
    txHistoryEl.innerHTML = ''
    if (txHistory.length === 0) {
      const li = document.createElement('li')
      li.className = 'tx-history__empty'
      li.textContent = 'No transactions recorded this session'
      txHistoryEl.appendChild(li)
      return
    }
    txHistory.forEach(tx => {
      const li = document.createElement('li')
      const icon = document.createElement('span')
      icon.className = 'tx-hist-icon'
      icon.textContent = tx.status === 'success' ? '✅' : '❌'

      const a = document.createElement('a')
      a.href = EXPLORER_BASE + tx.hash
      a.target = '_blank'
      a.rel = 'noopener'
      a.textContent = tx.hash

      const amt = document.createElement('span')
      amt.className = 'tx-hist-amount'
      amt.textContent = '-' + tx.amount + ' XLM'

      li.appendChild(icon)
      li.appendChild(a)
      li.appendChild(amt)
      txHistoryEl.appendChild(li)
    })
  }

  function setBtnLoading (btn, loading) {
    if (loading) {
      btn.classList.add('loading')
      btn.disabled = true
    } else {
      btn.classList.remove('loading')
      // re-enable only if wallet is connected (for sendBtn)
      if (btn === sendBtn || btn === refreshBtn) {
        btn.disabled = !publicKey
      } else {
        btn.disabled = false
      }
    }
  }

  function formatBalance (raw) {
    const num = parseFloat(raw)
    if (isNaN(num)) return '0.00'
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7
    })
  }

  /* ====================================================
     WALLET CONNECT
     ==================================================== */
  async function connect () {
    const api = getFreighter()
    if (!api) {
      setTxStatus('error', 'Freighter wallet not detected. Please install the Freighter browser extension and refresh.')
      walletStatus.classList.add('error')
      walletText.textContent = 'Freighter not found — install extension'
      return
    }

    setBtnLoading(connectBtn, true)
    setTxStatus('pending', 'Requesting wallet access…')

    try {
      // v6 API: requestAccess returns { address } or { error }
      let address = null

      if (typeof api.requestAccess === 'function') {
        const result = await api.requestAccess()
        address = result && result.address ? result.address : result
      } else if (typeof api.getPublicKey === 'function') {
        address = await api.getPublicKey()
      } else if (typeof api.getAddress === 'function') {
        const result = await api.getAddress()
        address = result && result.address ? result.address : result
      }

      if (!address || typeof address !== 'string' || !address.startsWith('G')) {
        throw new Error('Could not retrieve public key from Freighter.')
      }

      setWalletConnected(address)
      setTxStatus('success', 'Wallet connected successfully')
      await fetchBalance()
    } catch (err) {
      const msg = err && err.message ? err.message : String(err)
      if (msg.includes('User declined')) {
        setTxStatus('error', 'Connection request was declined by the user.')
      } else {
        setTxStatus('error', 'Connection failed: ' + msg)
      }
    } finally {
      setBtnLoading(connectBtn, false)
      if (publicKey) connectBtn.disabled = true
    }
  }

  /* ====================================================
     WALLET DISCONNECT
     ==================================================== */
  function disconnect () {
    setWalletDisconnected()
    setTxStatus('idle', 'Wallet disconnected')
  }

  /* ====================================================
     BALANCE
     ==================================================== */
  async function fetchBalance () {
    if (!publicKey) return

    balanceDisplay.classList.add('balance-display--loading')
    balanceAmount.textContent = 'Loading…'
    balanceCurrency.textContent = ''

    try {
      const account = await server.loadAccount(publicKey)
      const native = account.balances.find(b => b.asset_type === 'native')
      const raw = native ? native.balance : '0'
      balanceAmount.textContent = formatBalance(raw)
      balanceCurrency.textContent = 'XLM'
    } catch (err) {
      if (err && err.response && err.response.status === 404) {
        balanceAmount.textContent = '0.00'
        balanceCurrency.textContent = 'XLM'
        setTxStatus('error', 'Account not found on Testnet. Fund it via Friendbot first.')
      } else {
        balanceAmount.textContent = 'Error'
        balanceCurrency.textContent = ''
        setTxStatus('error', 'Balance fetch failed: ' + (err.message || err))
      }
    } finally {
      balanceDisplay.classList.remove('balance-display--loading')
    }
  }

  /* ====================================================
     SEND TRANSACTION
     ==================================================== */
  async function sendTransaction (destination, amount) {
    if (!publicKey) {
      setTxStatus('error', 'Connect your wallet first.')
      return
    }

    const api = getFreighter()
    if (!api) {
      setTxStatus('error', 'Freighter API not available.')
      return
    }

    // Validate destination
    try {
      StellarSdk.Keypair.fromPublicKey(destination)
    } catch (_) {
      setTxStatus('error', 'Invalid destination address. Must be a valid Stellar public key (starts with G).')
      destInput.classList.add('invalid')
      return
    }
    destInput.classList.remove('invalid')

    setBtnLoading(sendBtn, true)
    setTxStatus('pending', 'Building transaction…')

    try {
      // 1. Load source account
      const sourceAcct = await server.loadAccount(publicKey)

      // 2. Fetch base fee
      const fee = await server.fetchBaseFee()

      // 3. Build the transaction
      const tx = new StellarSdk.TransactionBuilder(sourceAcct, {
        fee: String(fee),
        networkPassphrase: NETWORK
      })
        .addOperation(StellarSdk.Operation.payment({
          destination: destination,
          asset: StellarSdk.Asset.native(),
          amount: String(amount)
        }))
        .setTimeout(30)
        .build()

      // 4. Request Freighter to sign
      setTxStatus('pending', 'Waiting for Freighter signature…')
      const xdr = tx.toXDR()
      let signedXDR = null

      if (typeof api.signTransaction === 'function') {
        const sig = await api.signTransaction(xdr, {
          networkPassphrase: NETWORK
        })
        signedXDR = sig && sig.signedTxXdr ? sig.signedTxXdr : (sig && sig.xdr ? sig.xdr : sig)
      } else if (typeof api.sign === 'function') {
        const sig = await api.sign(xdr, { networkPassphrase: NETWORK })
        signedXDR = sig && sig.xdr ? sig.xdr : sig
      }

      if (!signedXDR || typeof signedXDR !== 'string') {
        throw new Error('Signing returned no valid XDR.')
      }

      // 5. Reconstruct and submit
      setTxStatus('pending', 'Submitting to Stellar Testnet…')
      const signedTx = new StellarSdk.Transaction(signedXDR, NETWORK)
      const response = await server.submitTransaction(signedTx)
      const hash = response.hash

      // 6. Success
      setTxStatus('success', 'Transaction successful!', hash)
      addToHistory(hash, amount, destination, 'success')

      // 7. Refresh balance
      await fetchBalance()

      // 8. Clear form
      sendForm.reset()
    } catch (err) {
      let msg = 'Transaction failed'

      if (err && err.message) {
        msg = err.message
      }

      // Parse Horizon error extras
      if (err && err.response && err.response.data && err.response.data.extras) {
        const codes = err.response.data.extras.result_codes
        if (codes) {
          if (codes.operations && codes.operations.includes('op_underfunded')) {
            msg = 'Insufficient balance for this transaction.'
          } else if (codes.operations && codes.operations.includes('op_no_destination')) {
            msg = 'Destination account does not exist on the network.'
          } else if (codes.transaction) {
            msg = 'Transaction error: ' + codes.transaction
          }
        }
      }

      // User declined signing
      if (msg.includes('User declined') || msg.includes('rejected') || msg.includes('cancelled')) {
        msg = 'Transaction signing was cancelled by the user.'
      }

      setTxStatus('error', msg)
      addToHistory('—', amount, destination, 'failed')
    } finally {
      setBtnLoading(sendBtn, false)
    }
  }

  /* ====================================================
     COPY ADDRESS
     ==================================================== */
  async function copyAddress () {
    if (!publicKey) return
    try {
      await navigator.clipboard.writeText(publicKey)
      const original = copyBtn.textContent
      copyBtn.textContent = '✓'
      setTimeout(() => { copyBtn.textContent = original }, 1500)
    } catch (_) {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = publicKey
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      copyBtn.textContent = '✓'
      setTimeout(() => { copyBtn.textContent = '📋' }, 1500)
    }
  }

  /* ====================================================
     EVENT LISTENERS
     ==================================================== */
  connectBtn.addEventListener('click', connect)
  disconnectBtn.addEventListener('click', disconnect)
  refreshBtn.addEventListener('click', () => fetchBalance())
  copyBtn.addEventListener('click', copyAddress)

  sendForm.addEventListener('submit', async e => {
    e.preventDefault()
    const dest = destInput.value.trim()
    const amt  = amountInput.value.trim()

    if (!dest) {
      destInput.classList.add('invalid')
      setTxStatus('error', 'Please enter a destination address.')
      return
    }
    if (!amt || parseFloat(amt) <= 0) {
      amountInput.classList.add('invalid')
      setTxStatus('error', 'Please enter a valid amount greater than zero.')
      return
    }

    destInput.classList.remove('invalid')
    amountInput.classList.remove('invalid')
    await sendTransaction(dest, amt)
  })

  // Clear invalid styling on focus
  destInput.addEventListener('focus', () => destInput.classList.remove('invalid'))
  amountInput.addEventListener('focus', () => amountInput.classList.remove('invalid'))

  /* ====================================================
     INITIALISE
     ==================================================== */
  ;(async function init () {
    setTxStatus('idle', 'Detecting Freighter wallet…')

    const api = await detectFreighter()

    if (api) {
      setTxStatus('idle', 'Freighter detected — click Connect to begin')
      console.log('[REC] Freighter API detected ✓')
    } else {
      walletText.textContent = 'Freighter not found'
      walletStatus.classList.add('error')
      setTxStatus('error', 'Freighter wallet not detected. Install the extension and refresh this page.')
      console.warn('[REC] Freighter API not detected.')
    }
  })()
})()