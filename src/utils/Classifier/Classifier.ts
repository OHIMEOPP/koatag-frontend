import { TagData } from "components";

interface TagsByGroup {
  artist_tag: TagData[];
  another_tag: TagData[];
  character_tag: TagData[];
  group_tag: TagData[];
}

const Classifier = (tags: TagData[]): TagsByGroup => {
  const grouped = tags.reduce<TagsByGroup>((acc, tag) => {
    const group = tag.tag_group as keyof TagsByGroup; // 確保是合法 key
    acc[group].push(tag);
    return acc;
  }, {
    artist_tag: [],
    another_tag: [],
    character_tag: [],
    group_tag: []
  });

  return grouped;
};

export { Classifier };
