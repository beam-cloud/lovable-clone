import React, { forwardRef } from "react";
import styled from "styled-components";

interface NavLinkProps {
  href: string;
  reload?: boolean;
  className?: string;
  children: React.ReactNode;
  newWindow?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  active?: boolean;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  (
    {
      href,
      reload,
      className,
      children,
      newWindow = false,
      onClick,
      active = false,
    },
    ref
  ) => {
    const extraProps = {
      ...(newWindow && { target: "_blank" }),
    };

    if (onClick || reload || href.startsWith("http")) {
      return (
        <StyledOutLink
          ref={ref}
          href={href}
          className={className}
          {...extraProps}
          onClick={onClick}
          $active={active}
        >
          {children}
        </StyledOutLink>
      );
    }

    return (
      <StyledOutLink
        ref={ref}
        href={href}
        className={className}
        {...extraProps}
        $active={active}
      >
        {children}
      </StyledOutLink>
    );
  }
);

NavLink.displayName = "NavLink";

const StyledOutLink = styled.a<{ $active?: boolean }>`
  text-decoration: none;
  color: ${({ $active }) => ($active ? "#1f2937" : "#6b7280")};
  &:hover {
    color: #1f2937;
  }
`;

export default NavLink;
