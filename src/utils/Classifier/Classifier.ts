import { TagData } from "components";

interface TagsByGroup {
  ArtistTag: TagData[];
  anotherTag: TagData[];
  mainTag: TagData[];
  secondaryTag: TagData[];
}

const Classifier = (tags: TagData[]): TagsByGroup => {
  const grouped = tags.reduce<TagsByGroup>((acc, tag) => {
    const group = tag.Tag_Group as keyof TagsByGroup; // 確保是合法 key
    acc[group].push(tag);
    return acc;
  }, {
    ArtistTag: [],
    anotherTag: [],
    mainTag: [],
    secondaryTag: []
  });

  return grouped;
};

export { Classifier };
