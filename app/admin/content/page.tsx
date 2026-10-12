"use client";

import { adminAction, useAdminData } from "@/components/admin/useAdminData";

export default function AdminContentPage() {
  const { data, error, reload } = useAdminData();
  if (error) return <main className="p-8 text-pink-400">{error}</main>;
  if (!data) return <main className="p-8">Loading content…</main>;

  return (
    <main className="p-8">
      <h1 className="font-serif text-4xl">Content</h1>
      <form
        className="mt-8 grid max-w-2xl gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await adminAction("content.update", {
            heroHeadline: String(form.get("heroHeadline")),
            heroLede: String(form.get("heroLede")),
            farmStory: String(form.get("farmStory")),
          });
          reload();
        }}
      >
        <label className="text-sm">
          Hero headline
          <input name="heroHeadline" defaultValue={data.content.heroHeadline} className="mt-1 w-full border px-3 py-2" />
        </label>
        <label className="text-sm">
          Hero lede
          <textarea name="heroLede" defaultValue={data.content.heroLede} className="mt-1 w-full border px-3 py-2" />
        </label>
        <label className="text-sm">
          Farm story
          <textarea name="farmStory" defaultValue={data.content.farmStory} className="mt-1 w-full border px-3 py-2" />
        </label>
        <button className="bg-forest-900 py-2 text-xs uppercase tracking-[0.16em] text-ivory-50">Save copy</button>
      </form>
      <h2 className="mt-12 font-serif text-3xl">Room profiles</h2>
      <div className="mt-4 space-y-4">
        {data.rooms.map((room) => (
          <form
            key={room.id}
            className="border border-earth-700/15 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              await adminAction("room.update", {
                id: room.id,
                name: String(form.get("name")),
                description: String(form.get("description")),
                awaitingOwnerApproval: false,
              });
              reload();
            }}
          >
            <input name="name" defaultValue={room.name} className="w-full border px-3 py-2" />
            <textarea name="description" defaultValue={room.description} className="mt-2 w-full border px-3 py-2" />
            <button className="mt-2 text-sm underline">Save room</button>
          </form>
        ))}
      </div>
    </main>
  );
}
