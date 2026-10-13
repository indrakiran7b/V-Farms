import ResourcePage from '@/components/admin-resource-page'
export default function Page() { return <ResourcePage title="Bookings" kicker="Reservations" description="Search and manage the full-estate reservation ledger." table="stay_bookings" columns={['booking_reference', 'guest_name', 'check_in', 'check_out', 'booking_status', 'payment_status', 'total_paise']} /> }
