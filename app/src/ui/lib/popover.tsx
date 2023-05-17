import * as React from 'react'
import FocusTrap from 'focus-trap-react'
import { Options as FocusTrapOptions } from 'focus-trap'
import classNames from 'classnames'
import {
  ComputePositionReturn,
  autoUpdate,
  computePosition,
  limitShift,
} from '@floating-ui/react-dom'
import {
  arrow,
  flip,
  Middleware,
  MiddlewareState,
  offset,
  Placement,
  shift,
  Side,
  size,
} from '@floating-ui/core'
import { assertNever } from '../../lib/fatal-error'

/**
 * Position of the popover relative to its anchor element. It's composed by 2
 * dimensions:
 * - The first one is the edge of the anchor element from which the popover will
 *   be displayed.
 * - The second one is the alignment of the popover within that edge.
 *
 * Example: BottomRight means the popover will be in the bottom edge of the
 * anchor element, on its right side.
 **/
export enum PopoverAnchorPosition {
  Top = 'top',
  TopRight = 'top-right',
  TopLeft = 'top-left',
  Left = 'left',
  LeftTop = 'left-top',
  LeftBottom = 'left-bottom',
  Bottom = 'bottom',
  RightTop = 'right-top',
  Right = 'right',
}

/**
 * Position of the tip relative to the pop up in the dimension of the edge at
 * which the tip will be displayed.
 **/
export enum PopoverTipPosition {
  Start = 'start',
  Center = 'center',
  End = 'end',
}

export enum PopoverAppearEffect {
  Shake = 'shake',
}

const TipSize = 8
const TipCornerPadding = TipSize * 3

interface IPopoverProps {
  readonly onClickOutside?: (event?: MouseEvent) => void
  readonly onMousedownOutside?: (event?: MouseEvent) => void
  /** Element to anchor the popover to */
  readonly anchor?: HTMLElement | null
  /** The position of the popover relative to the anchor.  */
  readonly anchorPosition: PopoverAnchorPosition
  /**
   * The position of the tip or pointer of the popover relative to the side at
   * which the tip is presented. Optional. Default: Center
   */
  readonly tipPosition?: PopoverTipPosition
  readonly className?: string
  readonly style?: React.CSSProperties
  readonly appearEffect?: PopoverAppearEffect
  readonly ariaLabelledby?: string
  readonly trapFocus?: boolean // Default: true
  readonly showTip?: boolean // Default: true

  readonly maxHeight?: number
  readonly minHeight?: number
}

interface IPopoverState {
  readonly position: ComputePositionReturn | null
}

export class Popover extends React.Component<IPopoverProps, IPopoverState> {
  private focusTrapOptions: FocusTrapOptions
  private containerDivRef = React.createRef<HTMLDivElement>()
  private tipDivRef = React.createRef<HTMLDivElement>()
  private floatingCleanUp: (() => void) | null = null

  public constructor(props: IPopoverProps) {
    super(props)

    this.focusTrapOptions = {
      allowOutsideClick: true,
      escapeDeactivates: true,
      onDeactivate: this.props.onClickOutside,
    }

    this.state = { position: null }
  }

  private async setupPosition() {
    this.floatingCleanUp?.()

    if (
      this.props.anchor === null ||
      this.props.anchor === undefined ||
      this.containerDivRef.current === null
    ) {
      return
    }

    this.floatingCleanUp = autoUpdate(
      this.props.anchor,
      this.containerDivRef.current,
      this.updatePosition
    )
  }

  private updatePosition = async () => {
    if (
      this.props.anchor === null ||
      this.props.anchor === undefined ||
      this.containerDivRef.current === null
    ) {
      return
    }

    const containerDiv = this.containerDivRef.current
    const tipDiv = this.tipDivRef.current
    const { maxHeight, tipPosition } = this.props

    const shiftForTipAlignment = () =>
      ({
        name: 'shiftForTipAlignment',
        fn: (state: MiddlewareState) => {
          const side: Side = state.placement.split('-')[0] as Side

          const shiftDimension = {
            top: 'x' as const,
            right: 'y' as const,
            bottom: 'x' as const,
            left: 'y' as const,
          }[side]

          const factor =
            tipPosition === PopoverTipPosition.Start
              ? 1
              : tipPosition === PopoverTipPosition.End
              ? -1
              : 0
          return {
            [shiftDimension]:
              state[shiftDimension] +
              factor * (state.rects.floating.height / 2 - TipCornerPadding),
          }
        },
      } as Middleware)

    const middleware = [
      offset(TipSize),
      shiftForTipAlignment(),
      shift({
        // This will prevent the tip from being too close to corners of the popover
        limiter: limitShift({
          offset: TipSize * 3,
        }),
      }),
      flip(),
      size({
        apply({ availableHeight, availableWidth }) {
          Object.assign(containerDiv.style, {
            maxHeight:
              maxHeight === undefined
                ? `${availableHeight}px`
                : `${Math.min(availableHeight, maxHeight)}px`,
            maxWidth: `${availableWidth}px`,
          })
        },
        padding: 5,
      }),
    ]

    if (this.props.showTip !== false && tipDiv) {
      middleware.push(arrow({ element: tipDiv }))
    }

    const position = await computePosition(
      this.props.anchor,
      this.containerDivRef.current,
      {
        strategy: 'fixed',
        placement: this.getFloatingPlacementForAnchorPosition(),
        middleware,
      }
    )

    this.setState({ position })
  }

  public componentDidMount() {
    document.addEventListener('click', this.onDocumentClick)
    document.addEventListener('mousedown', this.onDocumentMouseDown)
    this.setupPosition()
  }

  // in component did update check if anchor changed, and if so setup position again
  public componentDidUpdate(prevProps: IPopoverProps) {
    if (prevProps.anchor !== this.props.anchor) {
      this.setupPosition()
    }
  }

  public componentWillUnmount() {
    document.removeEventListener('click', this.onDocumentClick)
    document.removeEventListener('mousedown', this.onDocumentMouseDown)
  }

  private onDocumentClick = (event: MouseEvent) => {
    const { current: ref } = this.containerDivRef
    const { target } = event

    if (
      ref !== null &&
      ref.parentElement !== null &&
      target instanceof Node &&
      !ref.parentElement.contains(target) &&
      this.props.onClickOutside !== undefined
    ) {
      this.props.onClickOutside(event)
    }
  }

  private onDocumentMouseDown = (event: MouseEvent) => {
    const { current: ref } = this.containerDivRef
    const { target } = event

    if (
      ref !== null &&
      ref.parentElement !== null &&
      target instanceof Node &&
      !ref.parentElement.contains(target) &&
      this.props.onMousedownOutside !== undefined
    ) {
      this.props.onMousedownOutside(event)
    }
  }

  public render() {
    const {
      trapFocus,
      className,
      appearEffect,
      ariaLabelledby,
      children,
      showTip,
      minHeight,
    } = this.props
    const cn = classNames(
      'popover-component',
      className,
      appearEffect && `appear-${appearEffect}`
    )

    const { position } = this.state
    // Make sure the popover *always* has at least `position: fixed` set, otherwise
    // it can cause weird layout glitches.
    const style: React.CSSProperties | undefined = {
      position: 'fixed',
      zIndex: 1000,
    }
    let tipStyle: React.CSSProperties = {}

    if (position) {
      style.top = position.y === undefined ? undefined : `${position.y}px`
      style.left = position.x === undefined ? undefined : `${position.x}px`
      style.height = minHeight === undefined ? undefined : `${minHeight}px`

      const arrow = position.middlewareData.arrow

      if (arrow) {
        const side: Side = position.placement.split('-')[0] as Side

        const staticSide = {
          top: 'bottom',
          right: 'left',
          bottom: 'top',
          left: 'right',
        }[side]

        const angle = {
          top: '270deg',
          right: '0deg',
          bottom: '90deg',
          left: '180deg',
        }[side]

        tipStyle = {
          top: arrow.y,
          left: arrow.x,
          transform: `rotate(${angle})`,
          [staticSide]: this.tipDivRef.current
            ? `${-this.tipDivRef.current.offsetWidth}px`
            : undefined,
        }
      }
    }

    return (
      <FocusTrap
        active={trapFocus !== false}
        focusTrapOptions={this.focusTrapOptions}
      >
        <div
          className={cn}
          style={style}
          ref={this.containerDivRef}
          aria-labelledby={ariaLabelledby}
          role="dialog"
        >
          {children}
          {showTip !== false && (
            <div
              className="popover-tip"
              style={{
                position: 'absolute',
                width: TipSize * 2,
                height: TipSize * 2,
                ...tipStyle,
              }}
              ref={this.tipDivRef}
            >
              <div
                className="popover-tip-border"
                style={{
                  position: 'absolute',
                  right: 1,
                  width: 0,
                  height: 0,
                  borderWidth: `${TipSize}px`,
                  borderRightWidth: `${TipSize - 1}px`,
                }}
                ref={this.tipDivRef}
              />
              <div
                className="popover-tip-background"
                style={{
                  position: 'absolute',
                  right: 0,
                  width: 0,
                  height: 0,
                  borderWidth: `${TipSize}px`,
                  borderRightWidth: `${TipSize - 1}px`,
                }}
                ref={this.tipDivRef}
              />
            </div>
          )}
        </div>
      </FocusTrap>
    )
  }

  private getFloatingPlacementForAnchorPosition(): Placement {
    if (1 !== NaN) {
      // return 'left'
    }
    const { anchorPosition } = this.props
    switch (anchorPosition) {
      case PopoverAnchorPosition.Top:
        return 'top'
      case PopoverAnchorPosition.TopLeft:
        return 'top-start'
      case PopoverAnchorPosition.TopRight:
        return 'top-end'
      case PopoverAnchorPosition.Left:
        return 'left'
      case PopoverAnchorPosition.LeftTop:
        return 'left-start'
      case PopoverAnchorPosition.LeftBottom:
        return 'left-end'
      case PopoverAnchorPosition.RightTop:
        return 'right-start'
      case PopoverAnchorPosition.Right:
        return 'right'
      case PopoverAnchorPosition.Bottom:
        return 'bottom'
      default:
        assertNever(anchorPosition, 'Unknown anchor position')
    }
  }
}
