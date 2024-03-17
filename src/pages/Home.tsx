import { Link } from "react-router-dom";
import { getThingyUrl } from "../routes";

export function Page() {
    return <div>
        <ul>
        <li><Link to={getThingyUrl('alpha')}>Alpha</Link></li>
        <li><Link to={getThingyUrl('beta')}>Beta</Link></li>
        <li><Link to={getThingyUrl('gamma')}>Gamma</Link></li>
        </ul>
    </div>
}