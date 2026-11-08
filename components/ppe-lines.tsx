export function PpeLines({
  groups,
}: {
  groups: { employeeId: string; items: { name: string; quantity: string; unit: string }[] }[];
}) {
  if (groups.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {groups.map((group) => (
        <li key={group.employeeId}>
          <p className="font-medium">Employee ID {group.employeeId}</p>
          <ul className="text-muted-foreground">
            {group.items.map((item) => (
              <li key={`${group.employeeId}-${item.name}`}>
                {item.name} · {item.quantity} {item.unit}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
