declare module 'choices.js' {
  interface ChoicesConfig {
    removeItemButton?: boolean
    allowHTML?: boolean
    placeholder?: boolean
    placeholderValue?: string
    searchEnabled?: boolean
    shouldSort?: boolean
  }

  export default class Choices {
    containerOuter: {
      element: HTMLElement
    }
    constructor(element: HTMLSelectElement, config?: ChoicesConfig)
    destroy(): void
    disable(): void
    enable(): void
    clearChoices(): void
    setChoices(
      choices: Array<{ value: string; label: string; selected?: boolean }>,
      valueKey: string,
      labelKey: string,
      replaceChoices?: boolean
    ): void
    removeActiveItems(): void
    setChoiceByValue(value: string): void
    getValue(): string | string[]
    getValue(valueOnly: true): string | string[]
  }
}

declare module 'choices.js/public/assets/styles/choices.min.css'
