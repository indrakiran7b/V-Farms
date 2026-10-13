import ResourcePage from '@/components/admin-resource-page'
export default function Page() { return <ResourcePage title="Calendar" kicker="Unified availability" description="The entire V-Farms estate is the booking unit. Holds and confirmed stays are shown from live inventory records." table="inventory_holds" columns={['check_in', 'check_out', 'expires_at', 'status']} /> }
