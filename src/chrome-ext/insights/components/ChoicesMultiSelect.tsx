import Choices from 'choices.js'
import { useEffect, useRef } from 'react'
import 'choices.js/public/assets/styles/choices.min.css'

interface ChoicesMultiSelectProps {
  id: string
  label: string
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  formatter?: (option: string) => string
  disabled?: boolean
  helperText?: string
}

const baseClasses =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200'

const ChoicesMultiSelect = ({
  id,
  label,
  options,
  value,
  onChange,
  formatter = (option) => option,
  disabled = false,
  helperText,
}: ChoicesMultiSelectProps) => {
  const selectRef = useRef<HTMLSelectElement | null>(null)
  const instanceRef = useRef<Choices | null>(null)

  useEffect(() => {
    if (!selectRef.current) {
      return undefined
    }

    const choices = new Choices(selectRef.current, {
      removeItemButton: true,
      allowHTML: false,
      placeholder: true,
      placeholderValue: 'All',
      searchEnabled: true,
      shouldSort: false,
    })

    const outer = choices.containerOuter.element
    baseClasses
      .split(' ')
      .filter(Boolean)
      .forEach((cls) => outer.classList.add(cls))
    outer.classList.add('choices')

    const handleChange = () => {
      const selected = choices.getValue(true)
      if (Array.isArray(selected)) {
        onChange(selected.map(String))
      } else if (typeof selected === 'string') {
        onChange([selected])
      } else {
        onChange([])
      }
    }

    selectRef.current.addEventListener('change', handleChange)
    instanceRef.current = choices

    return () => {
      selectRef.current?.removeEventListener('change', handleChange)
      choices.destroy()
      instanceRef.current = null
    }
  }, [onChange])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) {
      return
    }

    instance.clearChoices()
    instance.setChoices(
      options.map((option) => ({
        value: option,
        label: formatter(option),
        selected: value.includes(option),
      })),
      'value',
      'label',
      true
    )

    instance.removeActiveItems()
    value.forEach((selected) => {
      instance.setChoiceByValue(selected)
    })

    if (disabled) {
      instance.disable()
    } else {
      instance.enable()
    }
  }, [options, value, formatter, disabled])

  return (
    <label className="block text-sm">
      <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <select ref={selectRef} id={id} multiple disabled={disabled} className="hidden">
        {options.map((option) => (
          <option key={option} value={option}>
            {formatter(option)}
          </option>
        ))}
      </select>
      {helperText ? <span className="mt-2 block text-xs text-slate-500">{helperText}</span> : null}
    </label>
  )
}

export default ChoicesMultiSelect
