import NavLink from "../navlink";
import styled from "styled-components";

interface NavbarItemProps {
  label: string;
  href: string;
  onClick?: () => void;
  isActive?: boolean;
}

const NavbarItem: React.FC<NavbarItemProps> = ({
  label,
  href,
  onClick,
  isActive,
}) => {
  const handleOnClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    console.log("clicked");
    if (onClick) {
      onClick();
    }
  };

  return (
    <StyledLink
      href={href || ""}
      $isActive={isActive}
      onClick={onClick && handleOnClick}
    >
      {label}
    </StyledLink>
  );
};

export default NavbarItem;

const StyledLink = styled(NavLink)<{ $isActive?: boolean }>`
  font-size: 14px;
  font-weight: 500;
  &:hover {
    text-decoration: none;
  }
  color: ${(props) => (props.$isActive ? "#1f2937" : "#6b7280")};
  text-decoration: none;
  cursor: pointer;

  &:after {
    content: "";
    display: block;
    width: 50%;
    height: 2px;
    margin: 0 auto;
    opacity: ${(props) => (props.$isActive ? 1 : 0)};
    margin-top: 12px;
    background-color: #6b7280;
    border-radius: 2px;
  }
`;
