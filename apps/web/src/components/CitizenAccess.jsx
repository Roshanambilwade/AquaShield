import RoleGuard from "./RoleGuard.jsx";
export default function CitizenAccess({ children }) {
  return <RoleGuard role="CITIZEN">{children}</RoleGuard>;
}
