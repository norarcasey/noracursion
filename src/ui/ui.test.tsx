import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Noracursion } from '../components/Noracursion'
import { tokenize, tokenizeLines } from './highlight'
import { useEditableCode } from './useEditableCode'

expect.extend(toHaveNoViolations)

// Restoring the clock at the end of each fake-timer test is not enough: a test
// that fails never reaches its own cleanup, and every later test then waits on
// a clock that never ticks — turning one real failure into a suite of timeouts.
afterEach(() => {
  vi.useRealTimers()
})

const SORT = `for (let i = 0; i < arr.length; i++) {
  for (let j = 0; j < arr.length - i - 1; j++) {
    compare(j, j + 1)
    if (arr[j] > arr[j + 1]) swap(j, j + 1)
  }
}
`

function renderSort(props: Record<string, unknown> = {}) {
  return render(
    <Noracursion
      structure="array"
      operation="sort"
      initialData={[3, 1, 2]}
      code={SORT}
      {...props}
    />,
  )
}

describe('highlight', () => {
  it('separates keywords, strings, numbers and comments', () => {
    const tokens = tokenize(`const x = 'hi' // note\nlet y = 42`)
    const kinds = new Map(tokens.map((token) => [token.text.trim(), token.kind]))
    expect(kinds.get('const')).toBe('keyword')
    expect(kinds.get("'hi'")).toBe('string')
    expect(kinds.get('// note')).toBe('comment')
    expect(kinds.get('42')).toBe('number')
  })

  it('stops an unterminated quote at the end of the line', () => {
    // Otherwise one typo paints the rest of the file as a string.
    const lines = tokenizeLines(`const a = 'oops\nconst b = 1`)
    expect(lines).toHaveLength(2)
    expect(lines[1].some((token) => token.kind === 'keyword')).toBe(true)
  })

  it('keeps a token per line so the gutter stays aligned', () => {
    expect(tokenizeLines('a\n\nb')).toHaveLength(3)
  })

  it('never produces markup, only tokens', () => {
    // The editor renders spans from these; a highlighter that built an HTML
    // string would be one step from executing whatever the reader typed.
    const tokens = tokenize(`const a = '<img src=x onerror=alert(1)>'`)
    expect(tokens.every((token) => typeof token.text === 'string')).toBe(true)
    const rebuilt = tokens.map((token) => token.text).join('')
    expect(rebuilt).toBe(`const a = '<img src=x onerror=alert(1)>'`)
  })
})

describe('the code panel', () => {
  it('shows the code, numbered, in a labelled editor', () => {
    renderSort()
    const editor = screen.getByRole('textbox', { name: /editable source/i })
    expect(editor).toHaveValue(SORT)
    const gutter = document.querySelector<HTMLElement>('.nrc__gutter')
    if (gutter === null) throw new Error('no gutter')
    expect(within(gutter).getByText('1')).toBeInTheDocument()
    expect(within(gutter).getByText('6')).toBeInTheDocument()
  })

  it('highlights the line the interpreter is on', async () => {
    const user = userEvent.setup()
    const { container } = renderSort()
    expect(container.querySelector('.nrc__current-line')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Step forward' }))
    expect(container.querySelector('.nrc__current-line')).toHaveAttribute(
      'data-nrc-current-line',
      '1',
    )
  })

  it('runs the edited code, so the picture follows the edit', async () => {
    const user = userEvent.setup()
    const { container } = renderSort({ code: `swap(0, 1)` })
    const editor = screen.getByRole('textbox', { name: /editable source/i })

    await user.clear(editor)
    await user.type(editor, 'swap(0, 2)')
    // Pressing a transport control commits immediately, so play always runs
    // what is on screen rather than whatever the debounce last picked up.
    await user.click(screen.getByRole('button', { name: 'Step forward' }))
    await user.click(screen.getByRole('button', { name: 'Step forward' }))

    // 3,1,2 with 0 and 2 swapped is 2,1,3 — the edit really drove the picture.
    expect(
      Array.from(container.querySelectorAll('.nrc__node')).map(
        (node) => node.querySelector('text')?.textContent,
      ),
    ).toEqual(['2', '1', '3'])
  })

  it('commits an edit on its own once typing settles', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useEditableCode('first'))
    act(() => result.current.setDraft('second'))
    // The draft is what the reader sees; the run trails it, so the teaching
    // panel does not flash a syntax error on the way to every valid edit.
    expect(result.current.draft).toBe('second')
    expect(result.current.committed).toBe('first')
    expect(result.current.pending).toBe(true)

    act(() => vi.advanceTimersByTime(600))
    expect(result.current.committed).toBe('second')
    expect(result.current.pending).toBe(false)
  })

  it('is read-only when editable is false', () => {
    renderSort({ editable: false })
    expect(screen.getByRole('textbox', { name: /editable source/i })).toHaveAttribute('readonly')
  })

  it('hides the code panel when showCode is false', () => {
    renderSort({ showCode: false })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows a badge and refuses to run a language it cannot execute', () => {
    renderSort({ language: 'python', code: 'for i in range(3):\n    print(i)' })
    expect(screen.getByText(/Python shown for comparison/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument()
  })

  it('offers a choice rather than discarding edits when the code prop changes', async () => {
    const user = userEvent.setup()
    const { rerender } = renderSort({ code: `swap(0, 1)` })
    const editor = screen.getByRole('textbox', { name: /editable source/i })
    await user.clear(editor)
    await user.type(editor, 'mine')

    rerender(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[3, 1, 2]}
        code={`swap(1, 2)`}
      />,
    )

    // Nothing was thrown away: the reader is asked. (The step counter is an
    // <output>, which is also role=status, so this asks for the banner by text.)
    expect(editor).toHaveValue('mine')
    expect(screen.getByText(/you have edits/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load new code' }))
    expect(editor).toHaveValue('swap(1, 2)')
  })

  it('replaces untouched code silently, because there is nothing to lose', () => {
    const { rerender } = renderSort({ code: `swap(0, 1)` })
    rerender(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[3, 1, 2]}
        code={`swap(1, 2)`}
      />,
    )
    expect(screen.getByRole('textbox', { name: /editable source/i })).toHaveValue('swap(1, 2)')
    expect(screen.queryByText(/you have edits/)).not.toBeInTheDocument()
  })
})

describe('the transport', () => {
  it('steps forward and back over the same ground', async () => {
    const user = userEvent.setup()
    renderSort({ code: `swap(0, 1)` })
    const forward = screen.getByRole('button', { name: 'Step forward' })
    const back = screen.getByRole('button', { name: 'Step backward' })

    expect(back).toBeDisabled()
    await user.click(forward)
    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
    await user.click(back)
    expect(screen.getByText(/Step 0 of/)).toBeInTheDocument()
    expect(back).toBeDisabled()
  })

  it('plays, pauses and resets', () => {
    vi.useFakeTimers()
    renderSort({ speedMs: 10 })

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    const pause = screen.getByRole('button', { name: 'Pause' })
    expect(pause).toHaveAttribute('aria-pressed', 'true')

    act(() => vi.advanceTimersByTime(60))
    fireEvent.click(pause)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.queryByText(/Step 0 of/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset to the start' }))
    expect(screen.getByText(/Step 0 of/)).toBeInTheDocument()
  })

  it('is fully operable from the keyboard', async () => {
    const user = userEvent.setup()
    const { container } = renderSort({ code: `swap(0, 1)` })
    const root = container.querySelector('.nrc')
    if (root === null) throw new Error('no root')

    // Arrows step; space toggles play. Bound to the component, not to window,
    // so two examples on one page do not fight over the keys.
    await user.click(screen.getByRole('button', { name: 'Step forward' }))
    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText(/Step 0 of/)).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
  })

  it('leaves typing alone: space in the editor is a space', async () => {
    const user = userEvent.setup()
    renderSort({ code: `swap(0,1)` })
    const editor = screen.getByRole('textbox', { name: /editable source/i })
    await user.clear(editor)
    await user.type(editor, 'a b')
    expect(editor).toHaveValue('a b')
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('changes speed from the slider', async () => {
    const user = userEvent.setup()
    renderSort()
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAccessibleName(/milliseconds per step/)
    await user.click(slider)
    expect(slider).toBeInTheDocument()
  })

  it('hides the transport when showControls is false', () => {
    renderSort({ showControls: false })
    expect(screen.queryByRole('group', { name: 'Playback controls' })).not.toBeInTheDocument()
  })
})

describe('the inspector panels', () => {
  it('shows variables in scope at the current step', async () => {
    const user = userEvent.setup()
    renderSort({ code: `let total = 7\nlog(total)` })
    const variables = screen.getByRole('region', { name: 'Variables' })
    expect(within(variables).getByText('None in scope.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Step forward' }))
    await user.click(screen.getByRole('button', { name: 'Step forward' }))
    expect(within(variables).getByText('total')).toBeInTheDocument()
    expect(within(variables).getByText('7')).toBeInTheDocument()
  })

  it('shows the call stack innermost first, which is how recursion reads', async () => {
    const user = userEvent.setup()
    renderSort({
      code: `function outer() { return inner() }\nfunction inner() { return 1 }\nouter()`,
    })
    const stack = screen.getByRole('region', { name: 'Call stack' })
    expect(within(stack).getByText('Top level.')).toBeInTheDocument()

    for (let click = 0; click < 6; click += 1) {
      await user.click(screen.getByRole('button', { name: 'Step forward' }))
    }
    const frames = within(stack).getAllByRole('listitem')
    expect(frames[0]).toHaveTextContent('inner')
    expect(frames[frames.length - 1]).toHaveTextContent('outer')
  })

  it('accumulates log output as it runs', async () => {
    const user = userEvent.setup()
    renderSort({ code: `log('one')\nlog('two')` })
    const output = screen.getByRole('region', { name: 'Log output' })
    expect(within(output).getByText('Nothing logged yet.')).toBeInTheDocument()

    for (let click = 0; click < 3; click += 1) {
      await user.click(screen.getByRole('button', { name: 'Step forward' }))
    }
    expect(within(output).getByText('one')).toBeInTheDocument()
    expect(within(output).getByText('two')).toBeInTheDocument()
  })

  it('shows a legend when asked, naming what each colour means', () => {
    renderSort({ showLegend: true })
    const legend = screen.getByRole('region', { name: 'Legend' })
    expect(within(legend).getByText('Visiting')).toBeInTheDocument()
    expect(within(legend).getByText('Compared')).toBeInTheDocument()
  })
})

describe('teaching panels', () => {
  it('renders a runaway loop as a lesson, not a stack trace', () => {
    render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[1, 2]}
        code={`let current = 8\nwhile (current !== null) {\n  log(current)\n}`}
        maxLoopIterations={1000}
      />,
    )
    const panel = screen.getByRole('alert')
    expect(panel).toHaveTextContent('This loop ran 1000 times and never stopped.')
    // The line, and the code on it.
    expect(panel).toHaveTextContent('Line 2')
    expect(panel).toHaveTextContent('while (current !== null) {')
    // The first-versus-latest table is the actual teaching payload.
    expect(within(panel).getByText('current')).toBeInTheDocument()
    expect(panel).toHaveTextContent('(unchanged)')
    // And a concrete next edit.
    expect(panel).toHaveTextContent(/something inside the loop has to change/i)
  })

  it('renders unbounded recursion with a base case to write', () => {
    render(
      <Noracursion
        structure="array"
        operation="search"
        initialData={[1]}
        code={`function walk(node: number): number {\n  return walk(node + 1)\n}\nwalk(0)`}
      />,
    )
    const panel = screen.getByRole('alert')
    expect(panel).toHaveTextContent('called itself 200 times without stopping')
    expect(panel).toHaveTextContent('base case')
    expect(panel).toHaveTextContent('if (node === null) return')
  })

  it('names an unsupported construct and its line', () => {
    render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[1]}
        code={`let a = 1\ntry { a = 2 } catch (e) { a = 3 }`}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Noracursion can't run `try` / `catch` yet")
    expect(screen.getByRole('alert')).toHaveTextContent('Line 2')
  })
})

describe('accessibility', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('has no axe violations with everything on', async () => {
    const { container } = renderSort({ showLegend: true, title: 'Bubble sort' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations while showing a teaching panel', async () => {
    const { container } = render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[1, 2]}
        code={`let i = 0\nwhile (i < 5) { log(i) }`}
        maxLoopIterations={20}
        title="Broken loop"
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('reaches every control by tabbing', async () => {
    const user = userEvent.setup()
    renderSort()
    const reachable: string[] = []
    for (let tab = 0; tab < 7; tab += 1) {
      await user.tab()
      const active = document.activeElement
      if (active !== null && active !== document.body) {
        reachable.push(active.getAttribute('aria-label') ?? active.tagName)
      }
    }
    expect(reachable).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Play/),
        expect.stringMatching(/Step forward/),
      ]),
    )
    expect(reachable.some((label) => /editable source/i.test(label))).toBe(true)
  })
})
