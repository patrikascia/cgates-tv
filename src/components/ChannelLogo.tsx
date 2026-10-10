import type { Channel } from '../data/channels'

// No channel logos were provided, so we show a neutral typographic tile rather than
// inventing artwork.
export default function ChannelLogo({ channel, size = 'md' }: { channel: Channel; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`channel-logo channel-logo-${size}`} aria-hidden="true">
      {channel.monogram}
    </span>
  )
}
