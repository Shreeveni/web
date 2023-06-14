import React from 'react'
import { Select } from '../lib/select'
import { Button } from '../lib/button'
import { Row } from '../lib/row'
import { Popover, PopoverCaretPosition } from '../lib/popover'
import { IAvatarUser } from '../../models/avatar'
import { Avatar } from '../lib/avatar'
import { Octicon } from '../octicons'
import * as OcticonSymbol from '../octicons/octicons.generated'
import { LinkButton } from '../lib/link-button'
import { ToggledtippedContent } from '../lib/toggletipped-content'
import { TooltipDirection } from '../lib/tooltip'

interface ICommitMessageAvatarState {
  readonly isPopoverOpen: boolean

  /** Currently selected account email address. */
  readonly accountEmail: string
}

export type CommitMessageWarningType = 'none' | 'misattribution' | 'disallowedEmail'

interface ICommitMessageAvatarProps {
  /** The user whose avatar should be displayed. */
  readonly user?: IAvatarUser

  /** Current email address configured by the user. */
  readonly email?: string

  /**
   * Controls whether a warning should be displayed.
   * - 'none': No error is displayed, the field is valid.
   * - 'misattribution': The user's Git config emails don't match and the
   * commit may not be attributed to the user.
   * - 'disallowedEmail': A repository rule may prevent the user from
   * committing with the selected email address.
   */
  readonly warningType: CommitMessageWarningType

  /**
   * List of email validations that failed for rulesets. Only used if
   * {@link warningType} is 'disallowedEmail'.
   */
  readonly emailRuleErrors?: ReadonlyArray<string>

  /** Whether or not the user's account is a GHE account. */
  readonly isEnterpriseAccount: boolean

  /** Email addresses available in the relevant GitHub (Enterprise) account. */
  readonly accountEmails: ReadonlyArray<string>

  /** Preferred email address from the user's account. */
  readonly preferredAccountEmail: string

  readonly onUpdateEmail: (email: string) => void

  /**
   * Called when the user has requested to see the Git Config tab in the
   * repository settings dialog
   */
  readonly onOpenRepositorySettings: () => void
}

/**
 * User avatar shown in the commit message area. It encapsulates not only the
 * user avatar, but also any badge and warning we might display to the user.
 */
export class CommitMessageAvatar extends React.Component<
  ICommitMessageAvatarProps,
  ICommitMessageAvatarState
> {
  public constructor(props: ICommitMessageAvatarProps) {
    super(props)

    this.state = {
      isPopoverOpen: false,
      accountEmail: this.props.preferredAccountEmail,
    }
  }

  private getTitle(): string | JSX.Element | undefined {
    const { user } = this.props

    if (user === undefined) {
      return 'Unknown user'
    }

    const { name, email } = user

    if (user.name) {
      return (
        <>
          Committing as <strong>{name}</strong> {email}
        </>
      )
    }

    return email
  }

  public render() {
    let ariaLabel = ''
    switch (this.props.warningType) {
      case 'none':
        ariaLabel = 'Show Commit Author Details'
        break;

      case 'misattribution':
        ariaLabel = 'Commit may be misattributed. View warning.'
        break;

      case 'disallowedEmail':
        ariaLabel = 'Email address may be disallowed. View warning.'
        break
    }

    return (
      <div className="commit-message-avatar-component">
        {this.props.warningType !== 'none' && (
          <Button
            className="avatar-button"
            ariaLabel={ariaLabel}
            onClick={this.onAvatarClick}
          >
            {this.renderWarningBadge()}
            <Avatar user={this.props.user} title={null} />
          </Button>
        )}

        {this.props.warningType === 'none' && (
          <ToggledtippedContent
            tooltip={this.getTitle()}
            direction={TooltipDirection.NORTH}
            ariaLabel="Show Commit Author Details"
          >
            <Avatar user={this.props.user} title={null} />
          </ToggledtippedContent>
        )}

        {this.state.isPopoverOpen && this.renderPopover()}
      </div>
    )
  }

  private renderWarningBadge() {
    return (
      <div className="warning-badge">
        <Octicon symbol={OcticonSymbol.alert} />
      </div>
    )
  }

  private openPopover = () => {
    this.setState(prevState => {
      if (prevState.isPopoverOpen === false) {
        return { isPopoverOpen: true }
      }
      return null
    })
  }

  private closePopover = () => {
    this.setState(prevState => {
      if (prevState.isPopoverOpen) {
        return { isPopoverOpen: false }
      }
      return null
    })
  }

  private onAvatarClick = (event: React.FormEvent<HTMLButtonElement>) => {
    if (this.props.warningType === 'none') {
      return
    }

    event.preventDefault()
    if (this.state.isPopoverOpen) {
      this.closePopover()
    } else {
      this.openPopover()
    }
  }

  private renderPopover() {
    const accountTypeSuffix = this.props.isEnterpriseAccount
      ? ' Enterprise'
      : ''

    const updateEmailTitle = __DARWIN__ ? 'Update Email' : 'Update email'

    const userName =
      this.props.user && this.props.user.name
        ? ` for ${this.props.user.name}`
        : ''

    let header = ''
    switch (this.props.warningType) {
      case 'misattribution':
        header = 'This commit will be misattributed'
        break

      case 'disallowedEmail':
        header = 'This email address may be disallowed'
        break
    }

    return (
      <Popover
        caretPosition={PopoverCaretPosition.LeftBottom}
        onClickOutside={this.closePopover}
        ariaLabelledby="commit-message-avatar-popover-header"
      >
        <h3 id="commit-message-avatar-popover-header">
          {header}
        </h3>
        {this.props.warningType === 'misattribution' && (
          <Row>
            <div>
              The email in your global Git config (
              <span className="git-email">{this.props.email}</span>) doesn't match
              your GitHub{accountTypeSuffix} account{userName}.{' '}
              <LinkButton
                ariaLabel="Learn more about commit attribution"
                uri="https://docs.github.com/en/github/committing-changes-to-your-project/why-are-my-commits-linked-to-the-wrong-user"
              >
                Learn more
              </LinkButton>
            </div>
          </Row>
        )}
        {this.props.warningType === 'disallowedEmail' && (
          <Row>
            <div>
              The email in your global Git config (
              <span className="git-email">{this.props.email}</span>) may be blocked from pushing
              to this branch by one or more rules: {this.props.emailRuleErrors?.join(', ')}
            </div>
          </Row>
        )}
        <Row>
          <Select
            label="Your Account Emails"
            value={this.state.accountEmail}
            onChange={this.onSelectedGitHubEmailChange}
          >
            {this.props.accountEmails.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Row>
        <Row>
          <div className="secondary-text">
            You can also choose an email local to this repository from the{' '}
            <LinkButton onClick={this.onRepositorySettingsClick}>
              repository settings
            </LinkButton>
            .
          </div>
        </Row>
        <Row className="button-row">
          <Button onClick={this.onIgnoreClick} type="button">
            Ignore
          </Button>
          <Button onClick={this.onUpdateEmailClick} type="submit">
            {updateEmailTitle}
          </Button>
        </Row>
      </Popover>
    )
  }

  private onRepositorySettingsClick = () => {
    this.closePopover()
    this.props.onOpenRepositorySettings()
  }

  private onIgnoreClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    this.closePopover()
  }

  private onUpdateEmailClick = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    this.closePopover()

    if (this.props.email !== this.state.accountEmail) {
      this.props.onUpdateEmail(this.state.accountEmail)
    }
  }

  private onSelectedGitHubEmailChange = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const email = event.currentTarget.value
    if (email) {
      this.setState({ accountEmail: email })
    }
  }
}
