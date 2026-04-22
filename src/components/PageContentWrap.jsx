import cardsPageStyles from '../styles/CardsPage.module.css';

/**
 * Same max-width and centering as the Cards view (72rem, mobile edge-to-edge in parent).
 * @param {{ children: import('react').ReactNode, className?: string }} p
 */
export default function PageContentWrap({ children, className }) {
  return (
    <div className={[cardsPageStyles.wrap, className].filter(Boolean).join(' ')}>{children}</div>
  );
}
