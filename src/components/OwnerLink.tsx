import { useNav } from '../lib/nav';

interface Props {
  ownerId: string;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

// Renders a manager name as a clickable link that drills into ManagerDetail.
export default function OwnerLink({ ownerId, children, title, className }: Props) {
  const { goTo } = useNav();
  return (
    <a
      href="#"
      title={title}
      className={className}
      style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'rgba(201,168,76,0.4)', textUnderlineOffset: 3, cursor: 'pointer' }}
      onClick={(e) => {
        e.preventDefault();
        goTo({ kind: 'manager', ownerId });
      }}
    >
      {children}
    </a>
  );
}
