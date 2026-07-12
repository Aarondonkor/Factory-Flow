declare global {
  interface Window {
    PaystackPop: {
      setup: (options: PaystackOptions) => { openIframe: () => void }
    }
  }
}

interface PaystackOptions {
  key: string
  email: string
  amount: number
  currency?: string
  ref: string
  callback: (response: { reference: string; status: string }) => void
  onClose: () => void
}

const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY

export function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.head.appendChild(script)
  })
}

export async function initiatePaystackPayment(
  email: string,
  amountGhs: number,
  reference: string,
  onSuccess: (ref: string) => void,
  onClose?: () => void
): Promise<void> {
  if (!PAYSTACK_KEY) {
    throw new Error('Paystack public key not configured')
  }

  await loadPaystackScript()

  const handler = window.PaystackPop.setup({
    key: PAYSTACK_KEY,
    email,
    amount: Math.round(amountGhs * 100),
    currency: 'GHS',
    ref: reference,
    callback: (response) => {
      if (response.status === 'success') {
        onSuccess(response.reference)
      }
    },
    onClose: onClose || (() => {}),
  })

  handler.openIframe()
}

export function generatePaymentRef(orderNumber: string): string {
  return `PV-${orderNumber}-${Date.now()}`
}
