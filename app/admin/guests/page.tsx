import ResourcePage from '@/components/admin-resource-page'
export default function Page() { return <ResourcePage title="Guests" kicker="Guest directory" description="Guest records are derived from the existing booking ledger and remain protected behind admin auth." table="stay_bookings" columns={['guest_name', 'guest_email', 'guest_phone', 'guest_count', 'check_in', 'check_out']} /> }
