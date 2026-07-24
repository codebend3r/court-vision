import { Switch } from "court-vision";

export const Off = () => <Switch label="Qualified players only" defaultChecked={false} />;

export const On = () => <Switch label="Qualified players only" defaultChecked />;

export const Disabled = () => <Switch label="Locked filter" disabled />;

export const DisabledOn = () => <Switch label="Always applied" defaultChecked disabled />;
