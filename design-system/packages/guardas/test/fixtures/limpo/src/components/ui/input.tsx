import type { InputHTMLAttributes } from 'react'

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { tamanho?: string }) {
  return <input {...props} className="h-ctrl rounded-ctrl" />
}
