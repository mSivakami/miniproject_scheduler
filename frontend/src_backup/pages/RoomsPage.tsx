// pages/RoomsPage.tsx
import { useState } from "react";
import { useAppStore, Room } from "../store/useAppStore";
import { EntityPage } from "../components/EntityPage";

function RoomForm({
  item,
  onClose,
}: {
  item: Room | null;
  onClose: () => void;
}) {
  const { addRoom, updateRoom } = useAppStore();
  const [name, setName] = useState(item?.name ?? "");
  const [isLab, setLab] = useState(item?.is_lab ?? false);

  const save = () => {
    if (!name.trim()) return;
    const data = { name, is_lab: isLab };
    item ? updateRoom(item.id, data) : addRoom(data);
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-title">🏫 {item ? "Edit Room" : "Add Room"}</div>
      <div className="form-group">
        <label>Name</label>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Room name or number"
        />
      </div>
      <label className="form-checkbox" style={{ marginTop: 4 }}>
        <input
          type="checkbox"
          checked={isLab}
          onChange={(e) => setLab(e.target.checked)}
        />
        Laboratory room
      </label>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const { rooms, deleteRoom } = useAppStore();
  return (
    <EntityPage
      title="Rooms"
      subtitle={`${rooms.length} configured`}
      items={rooms}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "is_lab",
          label: "Type",
          render: (r) =>
            r.is_lab ? (
              <span className="chip chip-amber">LAB</span>
            ) : (
              <span className="chip chip-gray">CLASSROOM</span>
            ),
        },
      ]}
      renderForm={(item, close) => (
        <RoomForm item={item as Room} onClose={close} />
      )}
      onDelete={deleteRoom}
    />
  );
}
