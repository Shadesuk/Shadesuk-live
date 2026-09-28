/** Chosen gallery files. Empty picker entries are ignored. */
export function adminProductImageFiles(formData: FormData): File[] {
  return formData
    .getAll("image")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}
