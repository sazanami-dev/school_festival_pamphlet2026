import EventInfo from './components/EventInfo';
import FloorMap from './components/floormap/FloorMap';
export default function Home() {
  return (
    <div>
      <EventInfo />
      <div className="mx-auto w-full max-w-md">
        <FloorMap floor={5} />
      </div>
    </div>
  );
}
