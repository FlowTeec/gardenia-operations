"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CategoryPanel({
  categories,
  pending,
  onCreate,
  onSave,
}: {
  categories: { id: string; name: string; active: boolean; requiresEmployee: boolean }[];
  pending: boolean;
  onCreate: (name: string) => void;
  onSave: (input: { categoryId: string; name: string; active: boolean }) => void;
}) {
  const [name, setName] = useState("");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Categories</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Create a category, rename it, or deactivate it. Deactivating keeps the category
          and the materials. Team leaders only see materials in active categories, plus
          materials that have no category yet. PPE keeps employee ID tracking even if the
          name changes.
        </p>
      </div>
      <form
        className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name);
          setName("");
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="new-category">New category</Label>
          <Input
            id="new-category"
            value={name}
            className="h-10"
            placeholder="Category name"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" size="lg" disabled={pending || name.trim().length === 0}>
          Create category
        </Button>
      </form>
      <ul className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} pending={pending} onSave={onSave} />
        ))}
      </ul>
    </section>
  );
}

function CategoryRow({
  category,
  pending,
  onSave,
}: {
  category: { id: string; name: string; active: boolean; requiresEmployee: boolean };
  pending: boolean;
  onSave: (input: { categoryId: string; name: string; active: boolean }) => void;
}) {
  const [name, setName] = useState(category.name);
  const [active, setActive] = useState(category.active);
  const [seen, setSeen] = useState(`${category.id}:${category.name}:${category.active}`);
  const marker = `${category.id}:${category.name}:${category.active}`;
  if (seen !== marker) {
    setSeen(marker);
    setName(category.name);
    setActive(category.active);
  }

  return (
    <li>
      <form
        className="flex flex-col gap-2 rounded-lg border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ categoryId: category.id, name, active });
        }}
      >
        <Label htmlFor={`category-${category.id}`}>{category.requiresEmployee ? "PPE category" : "Category"}</Label>
        <Input
          id={`category-${category.id}`}
          value={name}
          className="h-10"
          onChange={(event) => setName(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Active
        </label>
        <Button type="submit" variant="outline" size="lg" disabled={pending}>
          Save category
        </Button>
      </form>
    </li>
  );
}
