import ResourcePage from '@/components/admin-resource-page'
export default function Page() { return <ResourcePage title="Notifications" kicker="Delivery queue" description="Review queued, sent, failed, and dead-letter booking notifications." table="booking_notifications" columns={['booking_id', 'channel', 'status', 'provider_message_id', 'attempt_count', 'last_error']} /> }
