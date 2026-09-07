type CollectionIntroProps = {
  children: string;
};

export function CollectionIntro({ children }: CollectionIntroProps) {
  return <p className="text-small">{children}</p>;
}
