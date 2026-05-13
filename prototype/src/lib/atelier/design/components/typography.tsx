import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { typeRamp, type TypeRampScale, fonts } from '../tokens';

/**
 * Type-ramp primitives — D-2 closure.
 *
 * Each primitive accepts a `scale` prop mapping to a tuple in `typeRamp`;
 * the tuple is applied inline so every value (size, leading, weight,
 * tracking, family, transform) comes from one source. Consumers compose
 * additional Tailwind utilities via `className` for layout/colour, but
 * the typography contract sits on the inline style.
 */

function rampStyle(scale: TypeRampScale): CSSProperties {
  const t = typeRamp[scale];
  const style: CSSProperties = {
    fontSize: t.size,
    lineHeight: t.leading,
    fontWeight: t.weight,
    letterSpacing: t.tracking,
    fontFamily: fonts[t.family],
  };
  if ('transform' in t && t.transform === 'uppercase') {
    style.textTransform = 'uppercase';
  }
  return style;
}

type TypographyProps<S extends TypeRampScale> = {
  scale?: S;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'style' | 'children'>;

export function Heading({
  scale = 'headingMd',
  as: Tag = 'h2',
  className,
  style,
  children,
  ...rest
}: TypographyProps<'displayLg' | 'displayMd' | 'headingLg' | 'headingMd' | 'headingSm'>) {
  return (
    <Tag {...rest} className={className} style={{ ...rampStyle(scale), ...style }}>
      {children}
    </Tag>
  );
}

export function Body({
  scale = 'bodyMd',
  as: Tag = 'p',
  className,
  style,
  children,
  ...rest
}: TypographyProps<'bodyLg' | 'bodyMd' | 'bodySm' | 'caption'>) {
  return (
    <Tag {...rest} className={className} style={{ ...rampStyle(scale), ...style }}>
      {children}
    </Tag>
  );
}

export function Eyebrow({
  as: Tag = 'span',
  className,
  style,
  children,
  ...rest
}: Omit<TypographyProps<'eyebrow'>, 'scale'>) {
  return (
    <Tag {...rest} className={className} style={{ ...rampStyle('eyebrow'), ...style }}>
      {children}
    </Tag>
  );
}

export function Mono({
  as: Tag = 'code',
  className,
  style,
  children,
  ...rest
}: Omit<TypographyProps<'mono'>, 'scale'>) {
  return (
    <Tag
      {...rest}
      className={className}
      style={{ ...rampStyle('mono'), fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {children}
    </Tag>
  );
}
