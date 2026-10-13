import ResourcePage from '@/components/admin-resource-page'

export default function Page() { return <ResourcePage title="Payments" kicker="Razorpay ledger" description="Track payment verification, capture state, and provider references without exposing secrets." table="payments" columns={['booking_id', 'razorpay_order_id', 'razorpay_payment_id', 'expected_amount_paise', 'captured_amount_paise', 'payment_status', 'verification_status', 'created_at']} /> }
